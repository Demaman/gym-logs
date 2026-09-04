'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, UserCheck, Activity, ChevronRight, Play,
  Timer, Dumbbell, CalendarCheck, TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/auth/store'
import { useRole } from '@/hooks/use-role'
import { useI18n } from '@/providers/i18n-provider'
import { useMyMemberships } from '@/hooks/identity/use-memberships'
import { useOrgAthletes } from '@/hooks/identity/use-org-athletes'
import { useOrgTrainers } from '@/hooks/identity/use-memberships'
import { useAthleteActiveSession } from '@/hooks/logs/use-athlete-active-session'
import { usePrograms } from '@/hooks/training/use-programs'
import { useAttendanceSummary } from '@/hooks/logs/use-attendance'
import type { MembershipEnriched, User } from '@/types/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function useCountUp(startedAt: Date | null) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!startedAt) { setElapsed(0); return }
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])
  return elapsed
}

function fmtElapsed(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function greeting(name: string) {
  const h = new Date().getHours()
  if (h < 12) return `Good morning, ${name}`
  if (h < 18) return `Good afternoon, ${name}`
  return `Good evening, ${name}`
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, unit, icon: Icon, href,
}: {
  label: string; value: string | number; unit?: string; icon: React.ElementType; href?: string
}) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => href && router.push(href)}
      className={cn(
        'flex flex-col gap-1 rounded-xl border border-border bg-card p-4 text-left',
        href && 'cursor-pointer transition-shadow hover:shadow-sm',
        !href && 'cursor-default',
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground/60" aria-hidden />
      </div>
      <p className="text-2xl font-bold tabular-nums text-foreground">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
      </p>
    </button>
  )
}

// ── Live session row ──────────────────────────────────────────────────────────

function LiveRow({ athleteId, email }: { athleteId: string; email: string }) {
  const router = useRouter()
  const { data: session } = useAthleteActiveSession(athleteId)
  const elapsed = useCountUp(session ? new Date(session.started_at) : null)
  if (!session) return null
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[color:var(--success)]/30 bg-[color:var(--success)]/5 px-4 py-3">
      <span className="size-2 shrink-0 rounded-full bg-[color:var(--success)] animate-pulse" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{email}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Timer className="size-3" aria-hidden />
          {session.name} · {fmtElapsed(elapsed)}
        </p>
      </div>
      <Button size="sm" onClick={() => router.push(`/logs/${session.id}`)}>
        Resume
      </Button>
    </div>
  )
}

// ── Client quick-row ──────────────────────────────────────────────────────────

function ClientQuickRow({
  athlete, programCount,
}: { athlete: MembershipEnriched; programCount: number }) {
  const router = useRouter()
  const { data: active } = useAthleteActiveSession(athlete.athlete_id)
  const initials = athlete.athlete_email.split('@')[0].slice(0, 2).toUpperCase()

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/40">
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
        {initials}
        {active && (
          <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-background bg-[color:var(--success)] animate-pulse" aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{athlete.athlete_email}</p>
        <p className="text-[10px] text-muted-foreground">
          {active
            ? <span className="text-[color:var(--success)] font-medium">Training now</span>
            : <>{programCount} program{programCount !== 1 ? 's' : ''}</>
          }
        </p>
      </div>
      {active ? (
        <button
          type="button"
          onClick={() => router.push(`/logs/${active.id}`)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[color:var(--success)] transition-colors hover:bg-[color:var(--success)]/10"
          aria-label="Resume session"
        >
          <Play className="size-3.5 fill-current" aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => router.push('/training')}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Go to training"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )
}

// ── Trainer overview ──────────────────────────────────────────────────────────

function TrainerOverview() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const { data: athletes = [], isLoading: loadingAthletes } = useMyMemberships()
  const { data: programs = [], isLoading: loadingPrograms } = usePrograms()
  const displayName = user?.email.split('@')[0] ?? 'Trainer'

  const assignedCount = programs.filter((p) => p.athlete_id != null).length

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="flex h-16 shrink-0 items-center border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
        <div>
          <h1 className="text-base font-semibold text-foreground capitalize">{greeting(displayName)}</h1>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </header>

      <main className="flex-1 space-y-6 p-4 md:p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Clients" value={athletes.length} icon={Users} href="/athletes" />
          <StatCard label="Programs" value={assignedCount} unit="assigned" icon={Dumbbell} href="/training" />
          <StatCard label="Attendance" value="Today" icon={CalendarCheck} href="/attendance" />
        </div>

        {/* Live sessions */}
        {!loadingAthletes && athletes.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Live sessions</p>
            </div>
            <div className="flex flex-col gap-2">
              {athletes.map((m) => (
                <LiveRow key={m.athlete_id} athleteId={m.athlete_id} email={m.athlete_email} />
              ))}
              {/* LiveRow only renders if session exists, so show empty state if all null */}
            </div>
          </section>
        )}

        {/* Clients */}
        <section>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Your clients</p>
            <button
              type="button"
              onClick={() => router.push('/athletes')}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:opacity-70"
            >
              View all <ChevronRight className="size-3" aria-hidden />
            </button>
          </div>
          {loadingAthletes ? (
            <div className="flex flex-col gap-1">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : athletes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Users className="size-8 text-muted" aria-hidden />
              <p className="text-sm text-muted-foreground">No clients yet</p>
              <Button size="sm" variant="outline" onClick={() => router.push('/settings')}>
                Invite a client
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card">
              {athletes.slice(0, 8).map((m, i) => {
                const count = programs.filter((p) => p.athlete_id === m.athlete_id).length
                return (
                  <div key={m.athlete_id} className={cn(i > 0 && 'border-t border-border')}>
                    <ClientQuickRow athlete={m} programCount={count} />
                  </div>
                )
              })}
              {athletes.length > 8 && (
                <div className="border-t border-border px-3 py-2.5 text-center">
                  <button
                    type="button"
                    onClick={() => router.push('/athletes')}
                    className="text-xs font-medium text-primary hover:opacity-70"
                  >
                    +{athletes.length - 8} more clients
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

// ── Gym admin overview ────────────────────────────────────────────────────────

function AdminOverview() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const { data: athletes = [], isLoading: loadingAthletes } = useOrgAthletes()
  const { data: trainers = [], isLoading: loadingTrainers } = useOrgTrainers()
  const { data: attendance } = useAttendanceSummary()
  const displayName = user?.email.split('@')[0] ?? 'Admin'

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="flex h-16 shrink-0 items-center border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
        <div>
          <h1 className="text-base font-semibold text-foreground capitalize">{greeting(displayName)}</h1>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </header>

      <main className="flex-1 space-y-6 p-4 md:p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Members"
            value={loadingAthletes ? '—' : athletes.length}
            icon={Users}
            href="/athletes"
          />
          <StatCard
            label="Trainers"
            value={loadingTrainers ? '—' : trainers.length}
            icon={UserCheck}
            href="/trainers"
          />
          <StatCard
            label="Check-ins today"
            value={attendance?.today_count ?? '—'}
            icon={Activity}
            href="/attendance"
          />
          <StatCard
            label="This week"
            value={attendance?.this_week_count ?? '—'}
            unit="check-ins"
            icon={TrendingUp}
            href="/attendance"
          />
        </div>

        {/* Live sessions — all athletes in the org */}
        {athletes.length > 0 && (
          <section>
            <p className="mb-3 text-sm font-semibold text-foreground">Live sessions</p>
            <div className="flex flex-col gap-2">
              {athletes.map((a: User) => (
                <LiveRow key={a.id} athleteId={a.id} email={a.email} />
              ))}
            </div>
          </section>
        )}

        {/* Quick links */}
        <section>
          <p className="mb-3 text-sm font-semibold text-foreground">Quick actions</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Manage trainers', icon: UserCheck, href: '/trainers' },
              { label: 'All members',     icon: Users,     href: '/athletes' },
              { label: 'Attendance',      icon: CalendarCheck, href: '/attendance' },
              { label: 'Member health',   icon: Activity,  href: '/member-health' },
            ].map(({ label, icon: Icon, href }) => (
              <button
                key={href}
                type="button"
                onClick={() => router.push(href)}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-shadow hover:shadow-sm"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="size-4 text-primary" aria-hidden />
                </span>
                <span className="text-xs font-medium text-foreground">{label}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const router = useRouter()
  const role = useRole()

  // Athletes don't have an overview — redirect to their logs dashboard
  useEffect(() => {
    if (role === 'athlete') router.replace('/logs')
  }, [role, router])

  if (role === 'athlete') return null
  if (role === 'trainer') return <TrainerOverview />
  return <AdminOverview />
}
