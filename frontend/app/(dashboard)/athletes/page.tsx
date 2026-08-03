'use client'

import { useState } from 'react'
import { Users, UserPlus, Loader2, MailPlus, Clock, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useRole } from '@/hooks/use-role'
import {
  useMyMemberships,
  useOrgMemberships,
  useDeleteMembership,
} from '@/hooks/identity/use-memberships'
import { useInvites, useInviteMember, useDeleteInvite } from '@/hooks/identity/use-invites'
import type { AxiosError } from 'axios'
import type { ApiError, Invite, MembershipEnriched } from '@/types/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function emailInitials(email: string) {
  const local = email.split('@')[0]
  const parts = local.split(/[._-]/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
    .padEnd(1, local[0]?.toUpperCase() ?? '?')
}

function formatExpiry(isoDate: string) {
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Invite dialog ─────────────────────────────────────────────────────────────

const inviteSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})
type InviteForm = z.infer<typeof inviteSchema>

function InviteDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const invite = useInviteMember()
  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '' },
  })

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) {
      form.reset()
      setServerError(null)
      setSuccessMsg(null)
    }
  }

  async function onSubmit(values: InviteForm) {
    setServerError(null)
    setSuccessMsg(null)
    try {
      const result = await invite.mutateAsync({ email: values.email, role: 'athlete' })
      const msg = result.accepted_at
        ? `${values.email} was linked immediately.`
        : `Invite sent to ${values.email}. They'll be linked when they register.`
      setSuccessMsg(msg)
      form.reset()
      onSuccess()
      setTimeout(() => setOpen(false), 1800)
    } catch (err) {
      const ax = err as AxiosError<ApiError>
      setServerError(ax.response?.data?.detail ?? 'Something went wrong. Please try again.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-2 size-4" aria-hidden />
          Invite client
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite a client</DialogTitle>
        </DialogHeader>

        {successMsg && (
          <Alert variant="success">
            <AlertDescription>{successMsg}</AlertDescription>
          </Alert>
        )}
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="e.g. client@example.com"
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={invite.isPending || !form.formState.isValid}
            >
              {invite.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              )}
              {invite.isPending ? 'Sending…' : 'Send invite'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ── Membership card ───────────────────────────────────────────────────────────

function MembershipCard({
  membership,
  showTrainer,
}: {
  membership: MembershipEnriched
  showTrainer: boolean
}) {
  const remove = useDeleteMembership()

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:bg-accent/30">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {emailInitials(membership.athlete_email)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {membership.athlete_email}
        </p>
        {showTrainer && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Trainer:{' '}
            <span className="text-foreground/80">{membership.trainer_email}</span>
          </p>
        )}
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            disabled={remove.isPending}
            aria-label={`Remove ${membership.athlete_email}`}
          >
            {remove.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="size-4" aria-hidden />
            )}
            <span className="ml-1.5 hidden sm:inline">Remove</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unlink <strong>{membership.athlete_email}</strong> from your organization.
              Their workout history and programs are kept — only the membership link is removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => remove.mutate(membership.id)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Pending invite row ────────────────────────────────────────────────────────

function InviteRow({ invite }: { invite: Invite }) {
  const cancel = useDeleteInvite()

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card/50 px-5 py-3">
      <MailPlus className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{invite.email}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" aria-hidden />
          Expires {formatExpiry(invite.expires_at)}
        </p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            disabled={cancel.isPending}
            aria-label={`Cancel invite to ${invite.email}`}
          >
            {cancel.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              'Cancel'
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel invite?</AlertDialogTitle>
            <AlertDialogDescription>
              The invite to <strong>{invite.email}</strong> will be cancelled. They won&apos;t
              be auto-linked if they register after this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep invite</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancel.mutate(invite.id)}
            >
              Cancel invite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function MembershipSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-8 w-20 rounded-lg" />
    </div>
  )
}

// ── Shared list renderer ──────────────────────────────────────────────────────

function AthletesList({
  linked,
  pending,
  isAdmin,
  isLoading,
}: {
  linked: MembershipEnriched[]
  pending: Invite[]
  isAdmin: boolean
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <main className="flex-1 space-y-3 p-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <MembershipSkeleton key={i} />
        ))}
      </main>
    )
  }

  if (linked.length === 0 && pending.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <Users className="size-10 text-muted" aria-hidden />
        <p className="font-semibold text-foreground">No clients yet</p>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? 'Invite clients or ask trainers to link theirs.'
            : 'Invite your first client to start tracking their progress.'}
        </p>
      </main>
    )
  }

  return (
    <main className="flex-1 space-y-6 p-6">
      {linked.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isAdmin ? 'All clients' : 'Linked clients'} · {linked.length}
          </h2>
          <div className="space-y-2">
            {linked.map((m) => (
              <MembershipCard key={m.id} membership={m} showTrainer={isAdmin} />
            ))}
          </div>
        </section>
      )}
      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pending invites · {pending.length}
          </h2>
          <div className="space-y-2">
            {pending.map((inv) => (
              <InviteRow key={inv.id} invite={inv} />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

function TrainerContent() {
  const memberships = useMyMemberships()
  const invites = useInvites()
  return (
    <AthletesList
      linked={memberships.data ?? []}
      pending={(invites.data ?? []).filter((i) => i.accepted_at === null)}
      isAdmin={false}
      isLoading={memberships.isLoading}
    />
  )
}

function AdminContent() {
  const memberships = useOrgMemberships()
  const invites = useInvites()
  return (
    <AthletesList
      linked={memberships.data ?? []}
      pending={(invites.data ?? []).filter((i) => i.accepted_at === null)}
      isAdmin={true}
      isLoading={memberships.isLoading}
    />
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AthletesPage() {
  const role = useRole()

  if (role !== 'trainer' && role !== 'gym_admin') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-semibold text-foreground">Access restricted</p>
        <p className="text-sm text-muted-foreground">
          This page is for trainers and gym admins.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <Users className="size-5 text-primary" aria-hidden />
          <h1 className="text-base font-semibold text-foreground">Clients</h1>
        </div>
        <InviteDialog onSuccess={() => {}} />
      </header>

      {role === 'gym_admin' ? <AdminContent /> : <TrainerContent />}
    </div>
  )
}
