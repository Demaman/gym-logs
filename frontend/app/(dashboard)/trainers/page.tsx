'use client'

import { useState } from 'react'
import { UserCheck, UserPlus, Loader2, MailPlus, Clock, Trash2 } from 'lucide-react'
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
import { useOrgTrainers, useOrgMemberships, useRemoveTrainer } from '@/hooks/identity/use-memberships'
import { useAuthStore } from '@/lib/auth/store'
import { useInvites, useInviteMember, useDeleteInvite } from '@/hooks/identity/use-invites'
import type { AxiosError } from 'axios'
import type { ApiError, Invite, User } from '@/types/api'

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

function InviteTrainerDialog({ onSuccess }: { onSuccess: () => void }) {
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
      const result = await invite.mutateAsync({ email: values.email, role: 'trainer' })
      const msg = result.accepted_at
        ? `${values.email} was linked as a trainer immediately.`
        : `Invite sent to ${values.email}. They'll join as a trainer when they register.`
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
          Invite trainer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite a trainer</DialogTitle>
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
                      placeholder="e.g. trainer@example.com"
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

// ── Trainer card ──────────────────────────────────────────────────────────────

function TrainerCard({
  trainer,
  athleteCount,
  isSelf,
}: {
  trainer: User
  athleteCount: number
  isSelf: boolean
}) {
  const remove = useRemoveTrainer()

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:bg-accent/30">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {emailInitials(trainer.email)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{trainer.email}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {athleteCount === 0
            ? 'No clients linked'
            : `${athleteCount} ${athleteCount === 1 ? 'client' : 'clients'}`}
        </p>
      </div>
      <span className="hidden shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary sm:inline-flex">
        {trainer.role === 'gym_admin' ? 'Gym Admin' : 'Trainer'}
      </span>
      {!isSelf && (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            disabled={remove.isPending}
            aria-label={`Remove ${trainer.email} from organization`}
          >
            {remove.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="size-4" aria-hidden />
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove trainer?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{trainer.email}</strong> will be removed from your gym. All their
              client links ({athleteCount} {athleteCount === 1 ? 'client' : 'clients'}) will be
              unlinked. Clients stay in the gym and can be reassigned. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep trainer</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => remove.mutate(trainer.id)}
            >
              Remove trainer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      )}
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
              join as a trainer if they register after this.
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

// ── Skeletons ─────────────────────────────────────────────────────────────────

function TrainerSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TrainersPage() {
  const role = useRole()
  const currentUser = useAuthStore((s) => s.user)
  const trainers = useOrgTrainers()
  const memberships = useOrgMemberships()
  const invites = useInvites()

  // role is null while the auth store is hydrating — show skeletons instead of
  // flashing "Access restricted" before the token is loaded into memory.
  if (role === null) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto">
        <header className="flex h-16 shrink-0 items-center border-b border-border bg-background/80 px-6" />
        <main className="flex-1 space-y-2 p-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <TrainerSkeleton key={i} />
          ))}
        </main>
      </div>
    )
  }

  if (role !== 'gym_admin') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-semibold text-foreground">Access restricted</p>
        <p className="text-sm text-muted-foreground">This page is for gym admins only.</p>
      </div>
    )
  }

  const isLoading = trainers.isLoading || memberships.isLoading

  // compute athlete count per trainer from memberships
  const athleteCountByTrainer: Record<string, number> = {}
  for (const m of memberships.data ?? []) {
    athleteCountByTrainer[m.trainer_id] = (athleteCountByTrainer[m.trainer_id] ?? 0) + 1
  }

  const trainerList = trainers.data ?? []
  const pending = (invites.data ?? []).filter(
    (inv) => inv.accepted_at === null && inv.role === 'trainer',
  )
  const trainerCount = trainerList.length

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <UserCheck className="size-5 text-primary" aria-hidden />
          <h1 className="text-base font-semibold text-foreground">
            Trainers{trainers.data ? ` · ${trainerCount}` : ''}
          </h1>
        </div>
        <InviteTrainerDialog onSuccess={() => {}} />
      </header>

      <main className="flex-1 space-y-6 p-6">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <TrainerSkeleton key={i} />
            ))}
          </div>
        ) : trainerList.length === 0 && pending.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <UserCheck className="size-10 text-muted" aria-hidden />
            <p className="font-semibold text-foreground">No trainers yet</p>
            <p className="text-sm text-muted-foreground">
              Invite trainers to your organization to get started.
            </p>
          </div>
        ) : (
          <>
            {trainerList.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Trainers · {trainerCount}
                </h2>
                <div className="space-y-2">
                  {trainerList.map((t) => (
                    <TrainerCard
                      key={t.id}
                      trainer={t}
                      athleteCount={athleteCountByTrainer[t.id] ?? 0}
                      isSelf={t.id === currentUser?.id}
                    />
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
          </>
        )}
      </main>
    </div>
  )
}
