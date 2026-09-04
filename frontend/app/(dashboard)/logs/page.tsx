'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dumbbell, Flame, Trophy, Calendar, ChevronRight, Plus, TrendingUp, ClipboardList, Users, Timer, Trash2, Loader2, Swords } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useRole } from '@/hooks/use-role'
import { useActiveSession } from '@/hooks/logs/use-active-session'
import { useAthleteActiveSession } from '@/hooks/logs/use-athlete-active-session'
import { useDiscardSession } from '@/hooks/logs/use-discard-session'
import { useI18n } from '@/providers/i18n-provider'
import { useAuthStore } from '@/lib/auth/store'
import { useMyOrganization } from '@/hooks/identity/use-settings'
import { useMyTrainer, useMyMemberships } from '@/hooks/identity/use-memberships'
import { Skeleton } from '@/components/ui/skeleton'
import { BattleJoinModal } from '@/components/logs/battle-join-modal'

// ── Count-up timer helpers ────────────────────────────────────────────────────

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

function formatCountUp(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── Mock data — athlete view ───────────────────────────────────────────────────

const WEEK_BARS = [
  { day: 'Mon', pct: 80,  vol: '3,280 kg', rest: false },
  { day: 'Tue', pct: 0,   vol: 'Rest',     rest: true  },
  { day: 'Wed', pct: 100, vol: '4,100 kg', rest: false },
  { day: 'Thu', pct: 68,  vol: '2,800 kg', rest: false },
  { day: 'Fri', pct: 0,   vol: 'Rest',     rest: true  },
  { day: 'Sat', pct: 95,  vol: '3,900 kg', rest: false },
  { day: 'Sun', pct: 29,  vol: '1,200 kg', rest: false, today: true },
]

const ATHLETE_SESSIONS = [
  {
    name:      'Push Day',
    date:      'Today',
    exercises: ['Bench Press', 'Overhead Press', 'Tricep Pushdown'],
    sets:      18,
    volume:    '3,280 kg',
    pr:        true,
  },
  {
    name:      'Leg Day',
    date:      'Jun 28',
    exercises: ['Squat', 'Romanian Deadlift', 'Leg Press', 'Calf Raise'],
    sets:      16,
    volume:    '4,100 kg',
    pr:        true,
  },
  {
    name:      'Pull Day',
    date:      'Jun 26',
    exercises: ['Deadlift', 'Pull-up', 'Barbell Row', 'Face Pull'],
    sets:      15,
    volume:    '2,850 kg',
    pr:        false,
  },
]

const TRAINER_SESSIONS = [
  {
    name:       'Push Day',
    date:       'Jun 30',
    athlete:    'Alex Chen',
    assignedBy: 'Carlos Mendoza',
    volume:     '3,280 kg',
    sets:       18,
    pr:         true,
  },
  {
    name:       'Leg Day',
    date:       'Jun 29',
    athlete:    'Emma Wilson',
    assignedBy: 'Sarah Johnson',
    volume:     '4,100 kg',
    sets:       16,
    pr:         false,
  },
  {
    name:       'Pull Day',
    date:       'Jun 28',
    athlete:    'Jordan Lee',
    assignedBy: 'Carlos Mendoza',
    volume:     '2,850 kg',
    sets:       15,
    pr:         false,
  },
  {
    name:       'Upper Body',
    date:       'Jun 28',
    athlete:    'Ryan Park',
    assignedBy: 'Mike Torres',
    volume:     '3,100 kg',
    sets:       12,
    pr:         false,
  },
]

// ── Stat card ─────────────────────────────────────────────────────────────────

type StatDatum = {
  label: string
  value: string
  unit:  string
  icon:  React.ElementType
  trend: string
  up:    boolean | null
}

function StatCard({ label, value, unit, icon: Icon, trend, up }: StatDatum) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-4 text-primary" aria-hidden />
        </span>
      </div>
      <div>
        <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
          {value}
          <span className="ml-1.5 text-lg font-medium text-muted-foreground">{unit}</span>
        </p>
        {trend && (
          <p className={cn(
            'mt-1 text-xs font-medium',
            up === true  && 'text-[color:var(--success)]',
            up === false && 'text-destructive',
            up === null  && 'text-muted-foreground',
          )}>
            {up === true && '↑ '}{up === false && '↓ '}{trend}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Volume bar chart (athlete view) ───────────────────────────────────────────

function VolumeChart({ totalLabel }: { totalLabel: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Volume this week</p>
        <p className="text-xs text-muted-foreground">{totalLabel} · 15,280 kg</p>
      </div>
      <div className="flex h-28 items-end gap-2">
        {WEEK_BARS.map(({ day, pct, vol, rest, today }) => (
          <div key={day} className="group relative flex flex-1 flex-col items-center gap-1.5">
            {/* Tooltip */}
            <div className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[10px] font-medium text-background group-hover:block">
              {vol}
            </div>
            {/* Bar */}
            <div className="relative flex w-full flex-1 items-end rounded-md bg-secondary">
              {pct > 0 && (
                <div
                  className={cn(
                    'w-full rounded-md transition-all duration-300',
                    today ? 'bg-primary/60' : 'bg-primary',
                  )}
                  style={{ height: `${pct}%` }}
                />
              )}
            </div>
            {/* Day label */}
            <p className={cn(
              'text-[10px] font-medium',
              today  ? 'text-primary'     : 'text-muted-foreground',
              rest   && 'opacity-40',
            )}>
              {day}
            </p>
            {today && (
              <span className="absolute -bottom-4 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Athlete session row ────────────────────────────────────────────────────────

function AthleteSessionRow({
  name, date, exercises, sets, volume, pr,
}: typeof ATHLETE_SESSIONS[0]) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-4 transition-colors hover:bg-accent/30 md:px-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Dumbbell className="size-5 text-primary" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{name}</p>
          {pr && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
              PR
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {exercises.join(' · ')}
        </p>
      </div>
      <div className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex">
        <p className="text-xs font-semibold tabular-nums text-foreground">{volume}</p>
        <p className="text-[10px] text-muted-foreground">{sets} sets · {date}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" aria-hidden />
    </div>
  )
}

// ── Trainer session row ────────────────────────────────────────────────────────

function TrainerSessionRow({
  name, date, athlete, assignedBy, volume, sets, pr,
}: typeof TRAINER_SESSIONS[0]) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-4 transition-colors hover:bg-accent/30 md:px-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <ClipboardList className="size-5 text-primary" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{name}</p>
          {pr && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
              PR
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs font-medium text-foreground/80">{athlete}</p>
        <p className="text-[10px] text-muted-foreground">{t.logs.assignedBy} {assignedBy}</p>
      </div>
      <div className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex">
        <p className="text-xs font-semibold tabular-nums text-foreground">{volume}</p>
        <p className="text-[10px] text-muted-foreground">{sets} sets · {date}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" aria-hidden />
    </div>
  )
}

// ── Gym card (athlete only, when linked) ──────────────────────────────────────

function GymCard() {
  const { data: org, isLoading: orgLoading } = useMyOrganization()
  const { data: trainer, isLoading: trainerLoading } = useMyTrainer()

  if (orgLoading || trainerLoading) {
    return <Skeleton className="h-16 w-full rounded-xl" />
  }

  if (!org) return null

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Users className="size-5 text-primary" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{org.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {trainer ? `Trainer: ${trainer.trainer_email}` : 'No trainer assigned yet'}
        </p>
      </div>
    </div>
  )
}

// ── Role-specific views ────────────────────────────────────────────────────────

function AthleteView() {
  const router = useRouter()
  const { data: activeSession } = useActiveSession()
  const { t } = useI18n()
  const user = useAuthStore((s) => s.user)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [joinBattleOpen, setJoinBattleOpen] = useState(false)
  const discard = useDiscardSession(activeSession?.id ?? '')
  const startedAt = activeSession ? new Date(activeSession.started_at) : null
  const elapsed = useCountUp(startedAt)

  useEffect(() => {
    if (!discardOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setDiscardOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [discardOpen])

  const ATHLETE_STATS: StatDatum[] = [
    {
      label:  t.logs.volume,
      value:  '12,450',
      unit:   'kg',
      icon:   TrendingUp,
      trend:  '+8%',
      up:     true,
    },
    {
      label:  t.logs.sessions,
      value:  '3',
      unit:   'workouts',
      icon:   Calendar,
      trend:  'of 4 planned',
      up:     null,
    },
    {
      label:  t.logs.streak,
      value:  '7',
      unit:   'days',
      icon:   Flame,
      trend:  'Personal best',
      up:     true,
    },
    {
      label:  t.logs.prs,
      value:  '2',
      unit:   'records',
      icon:   Trophy,
      trend:  'Bench · Squat',
      up:     null,
    },
  ]

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
        <div>
          <h1 className="text-base font-semibold text-foreground">{t.logs.title}</h1>
          <p className="text-xs text-muted-foreground">{t.logs.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setJoinBattleOpen(true)}>
            <Swords className="size-4" aria-hidden />
            <span className="hidden sm:inline">{t.battle.joinBattle}</span>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => router.push('/logs/new')}>
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">{t.logs.logWorkout}</span>
            <span className="sm:hidden">
              <Plus className="size-4" aria-hidden />
            </span>
          </Button>
        </div>
      </header>
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{t.logs.welcomeBack} 👋</h2>
          <p className="text-sm text-muted-foreground">{t.logs.weekOverview}</p>
        </div>
        {activeSession && (
          <>
            <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 md:px-5">
              <div className="flex items-center gap-3">
                <span className="size-2 shrink-0 rounded-full bg-[color:var(--success)] animate-pulse" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{activeSession.name} {t.logs.activeSession}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Timer className="size-3" aria-hidden />
                    {formatCountUp(elapsed)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                  onClick={() => setDiscardOpen(true)}
                  aria-label="Discard session"
                >
                  <Trash2 className="size-4" aria-hidden />
                  <span className="hidden sm:inline ml-1">{t.logs.discardSession}</span>
                </Button>
                <Button size="sm" onClick={() => router.push(`/logs/${activeSession.id}`)}>{t.logs.continueSession}</Button>
              </div>
            </div>
            {discardOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setDiscardOpen(false)} aria-hidden="true" />
                <div
                  role="alertdialog"
                  aria-modal="true"
                  aria-label="Discard workout"
                  className="fixed inset-x-4 bottom-4 z-50 rounded-2xl border border-border bg-background p-5 shadow-xl sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-sm sm:-translate-x-1/2"
                >
                  <h2 className="text-base font-semibold text-foreground">Discard workout?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This will permanently delete this session and all logged sets. You cannot undo this.
                  </p>
                  <div className="mt-5 flex gap-2.5">
                    <Button variant="outline" className="flex-1" onClick={() => setDiscardOpen(false)}>
                      Keep it
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      disabled={discard.isPending}
                      onClick={() => discard.mutate(undefined, { onSuccess: () => setDiscardOpen(false) })}
                    >
                      {discard.isPending ? (
                        <><Loader2 className="size-4 animate-spin" aria-hidden />Discarding…</>
                      ) : (
                        'Discard'
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
        {user?.organization_id && <GymCard />}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {ATHLETE_STATS.map((s) => <StatCard key={s.label} {...s} />)}
        </div>
        <VolumeChart totalLabel={t.logs.totalVolume} />
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{t.logs.recentSessions}</p>
            <button
              type="button"
              onClick={() => router.push('/logs/history')}
              className="flex items-center gap-1 text-xs font-medium text-primary transition-opacity hover:opacity-70"
            >
              {t.logs.viewAll} <ChevronRight className="size-3" aria-hidden />
            </button>
          </div>
          <div className="flex flex-col gap-2.5">
            {ATHLETE_SESSIONS.map((s) => <AthleteSessionRow key={s.name + s.date} {...s} />)}
          </div>
        </div>
      </main>
      <BattleJoinModal open={joinBattleOpen} onClose={() => setJoinBattleOpen(false)} />
    </div>
  )
}

// One row per athlete — only renders when that athlete has an active session
function LiveAthleteRow({ athleteId, email }: { athleteId: string; email: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const { data: session } = useAthleteActiveSession(athleteId)
  const elapsed = useCountUp(session ? new Date(session.started_at) : null)
  if (!session) return null
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--success)]/30 bg-[color:var(--success)]/5 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="size-2 shrink-0 rounded-full bg-[color:var(--success)] animate-pulse" />
        <div>
          <p className="text-sm font-semibold text-foreground">{email}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Timer className="size-3" aria-hidden />
            {session.name} · {formatCountUp(elapsed)}
          </p>
        </div>
      </div>
      <Button size="sm" onClick={() => router.push(`/logs/${session.id}`)}>
        {t.logs.continueSession}
      </Button>
    </div>
  )
}

function TrainerView() {
  const { t } = useI18n()
  const { data: myAthletes = [] } = useMyMemberships()

  const TRAINER_STATS: StatDatum[] = [
    {
      label: t.logs.teamVolume,
      value: '84,320',
      unit:  'kg',
      icon:  TrendingUp,
      trend: '+12% vs last week',
      up:    true,
    },
    {
      label: t.logs.teamSessions,
      value: '47',
      unit:  'workouts',
      icon:  Calendar,
      trend: 'this week',
      up:    null,
    },
    {
      label: t.logs.activeAthletes,
      value: '4',
      unit:  'athletes',
      icon:  Users,
      trend: 'training this week',
      up:    null,
    },
    {
      label: t.logs.teamPRs,
      value: '3',
      unit:  'records',
      icon:  Trophy,
      trend: 'this month',
      up:    null,
    },
  ]

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
        <div>
          <h1 className="text-base font-semibold text-foreground">{t.logs.teamLogs}</h1>
          <p className="text-xs text-muted-foreground">{t.logs.teamSubtitle}</p>
        </div>
      </header>
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {TRAINER_STATS.map((s) => <StatCard key={s.label} {...s} />)}
        </div>

        {/* Live sessions — athletes currently training */}
        {myAthletes.length > 0 && (
          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">{t.logs.liveSessions}</p>
            <div className="flex flex-col gap-2">
              {myAthletes.map((m) => (
                <LiveAthleteRow key={m.athlete_id} athleteId={m.athlete_id} email={m.athlete_email} />
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{t.logs.recentSessions}</p>
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-medium text-primary transition-opacity hover:opacity-70"
            >
              {t.logs.viewAll} <ChevronRight className="size-3" aria-hidden />
            </button>
          </div>
          <div className="flex flex-col gap-2.5">
            {TRAINER_SESSIONS.map((s) => <TrainerSessionRow key={s.name + s.date + s.athlete} {...s} />)}
          </div>
        </div>
      </main>
    </div>
  )
}

function GymAdminRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.push('/overview')
  }, [router])
  return null
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LogsPage() {
  const role = useRole()

  if (role === 'gym_admin') return <GymAdminRedirect />
  if (role === 'trainer')   return <TrainerView />
  return <AthleteView />
}
