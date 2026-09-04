'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Users, UserPlus, Loader2, MailPlus, Clock, Trash2, ChevronRight } from 'lucide-react'
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
import { useI18n } from '@/providers/i18n-provider'
import {
  useMyMemberships,
  useOrgMemberships,
  useDeleteMembership,
} from '@/hooks/identity/use-memberships'
import { useInvites, useInviteMember, useDeleteInvite } from '@/hooks/identity/use-invites'
import { useOrgAthletes } from '@/hooks/identity/use-org-athletes'
import type { AxiosError } from 'axios'
import type { ApiError, Invite, MembershipEnriched, User } from '@/types/api'

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

function formatExpiry(isoDate: string, locale: string) {
  return new Date(isoDate).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

// ── Invite dialog ─────────────────────────────────────────────────────────────

const inviteSchema = z.object({
  email: z.string().email(),
})
type InviteForm = z.infer<typeof inviteSchema>

function InviteDialog({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useI18n()
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
        ? `${values.email} ${t.athletes.linkedImmediately}`
        : `${t.athletes.inviteSentTo} ${values.email}. ${t.athletes.inviteSentSuffix}`
      setSuccessMsg(msg)
      form.reset()
      onSuccess()
      setTimeout(() => setOpen(false), 1800)
    } catch (err) {
      const ax = err as AxiosError<ApiError>
      setServerError(ax.response?.data?.detail ?? t.athletes.errorGeneric)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-2 size-4" aria-hidden />
          {t.athletes.inviteBtn}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.athletes.inviteDialogTitle}</DialogTitle>
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
                  <FormLabel>{t.athletes.emailLabel} *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder={t.athletes.emailPlaceholder}
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
              {invite.isPending ? t.athletes.sending : t.athletes.sendInvite}
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
  const { t } = useI18n()
  const remove = useDeleteMembership()

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:bg-accent/30">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {emailInitials(membership.athlete_email)}
      </span>
      <Link
        href={`/athletes/${membership.athlete_id}`}
        className="min-w-0 flex-1 group"
      >
        <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
          {membership.athlete_email}
        </p>
        {showTrainer && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t.athletes.trainerLabel}:{' '}
            <span className="text-foreground/80">{membership.trainer_email}</span>
          </p>
        )}
        {!showTrainer && (
          <p className="mt-0.5 text-xs text-muted-foreground group-hover:text-primary/70 transition-colors">
            {t.athletes.viewProgress}
          </p>
        )}
      </Link>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            disabled={remove.isPending}
            aria-label={`${t.athletes.removeBtn} ${membership.athlete_email}`}
          >
            {remove.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="size-4" aria-hidden />
            )}
            <span className="ml-1.5 hidden sm:inline">{t.athletes.removeBtn}</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.athletes.removeTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.athletes.removeDescPre}{' '}
              <strong>{membership.athlete_email}</strong>{' '}
              {t.athletes.removeDescPost}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => remove.mutate(membership.id)}
            >
              {t.athletes.removeConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Pending invite row ────────────────────────────────────────────────────────

function InviteRow({ invite }: { invite: Invite }) {
  const { t, locale } = useI18n()
  const cancel = useDeleteInvite()

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card/50 px-5 py-3">
      <MailPlus className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{invite.email}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" aria-hidden />
          {t.athletes.expires} {formatExpiry(invite.expires_at, locale)}
        </p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            disabled={cancel.isPending}
            aria-label={`${t.athletes.cancelInviteBtn} ${invite.email}`}
          >
            {cancel.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              t.athletes.cancelInviteBtn
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.athletes.cancelInviteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.athletes.cancelInviteDescPre}{' '}
              <strong>{invite.email}</strong>{' '}
              {t.athletes.cancelInviteDescPost}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.athletes.keepInvite}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancel.mutate(invite.id)}
            >
              {t.athletes.cancelInviteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Unlinked athlete card (no trainer assigned) ───────────────────────────────

function UnlinkedAthleteCard({ user }: { user: User }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:bg-accent/30">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
        {emailInitials(user.email)}
      </span>
      <Link href={`/athletes/${user.id}`} className="min-w-0 flex-1 group">
        <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
          {user.email}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t.athletes.noTrainer}</p>
      </Link>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
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
  unlinked = [],
  pending,
  isAdmin,
  isLoading,
}: {
  linked: MembershipEnriched[]
  unlinked?: User[]
  pending: Invite[]
  isAdmin: boolean
  isLoading: boolean
}) {
  const { t } = useI18n()

  if (isLoading) {
    return (
      <main className="flex-1 space-y-3 p-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <MembershipSkeleton key={i} />
        ))}
      </main>
    )
  }

  if (linked.length === 0 && unlinked.length === 0 && pending.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <Users className="size-10 text-muted" aria-hidden />
        <p className="font-semibold text-foreground">{t.athletes.noClients}</p>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? t.athletes.noClientsDescAdmin : t.athletes.noClientsDescTrainer}
        </p>
      </main>
    )
  }

  return (
    <main className="flex-1 space-y-6 p-6">
      {linked.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isAdmin ? t.athletes.assignedClients : t.athletes.linkedClients} · {linked.length}
          </h2>
          <div className="space-y-2">
            {linked.map((m) => (
              <MembershipCard key={m.id} membership={m} showTrainer={isAdmin} />
            ))}
          </div>
        </section>
      )}
      {unlinked.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t.athletes.unassignedClients} · {unlinked.length}
          </h2>
          <div className="space-y-2">
            {unlinked.map((a) => (
              <UnlinkedAthleteCard key={a.id} user={a} />
            ))}
          </div>
        </section>
      )}
      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t.athletes.pendingInvites} · {pending.length}
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
  const orgAthletes = useOrgAthletes()
  const invites = useInvites()

  // Deduplicate memberships: one row per athlete, keeping the most-recent trainer link.
  const linkedDeduped = (() => {
    const latest = new Map<string, MembershipEnriched>()
    for (const m of memberships.data ?? []) {
      const existing = latest.get(m.athlete_id)
      if (!existing || m.created_at > existing.created_at) {
        latest.set(m.athlete_id, m)
      }
    }
    return [...latest.values()]
  })()

  const linkedIds = new Set(linkedDeduped.map((m) => m.athlete_id))
  const unlinked = (orgAthletes.data ?? []).filter((a) => !linkedIds.has(a.id))

  return (
    <AthletesList
      linked={linkedDeduped}
      unlinked={unlinked}
      pending={(invites.data ?? []).filter((i) => i.accepted_at === null)}
      isAdmin={true}
      isLoading={memberships.isLoading || orgAthletes.isLoading}
    />
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AthletesPage() {
  const role = useRole()
  const { t } = useI18n()

  if (role !== 'trainer' && role !== 'gym_admin') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-semibold text-foreground">{t.athletes.accessRestricted}</p>
        <p className="text-sm text-muted-foreground">{t.athletes.accessRestrictedDesc}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <Users className="size-5 text-primary" aria-hidden />
          <h1 className="text-base font-semibold text-foreground">{t.athletes.title}</h1>
        </div>
        <InviteDialog onSuccess={() => {}} />
      </header>

      {role === 'gym_admin' ? <AdminContent /> : <TrainerContent />}
    </div>
  )
}
