import { LayoutDashboard, UserCheck, Users, Calendar, Dumbbell, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Mock data ─────────────────────────────────────────────────────────────────

const STATS = [
  {
    label: 'Trainers',
    value: '3',
    sub:   'in your organization',
    icon:  UserCheck,
  },
  {
    label: 'Athletes',
    value: '15',
    sub:   'across all trainers',
    icon:  Users,
  },
  {
    label: 'Sessions this week',
    value: '47',
    sub:   '+12% vs last week',
    up:    true,
    icon:  Calendar,
  },
  {
    label: 'Org volume this month',
    value: '84,320',
    unit:  'kg',
    sub:   null,
    icon:  Dumbbell,
  },
]

const TRAINERS = [
  { name: 'Carlos Mendoza', athletes: 5,  sessions: 18, volume: '28,400 kg' },
  { name: 'Sarah Johnson',  athletes: 3,  sessions: 12, volume: '19,800 kg' },
  { name: 'Mike Torres',    athletes: 7,  sessions: 17, volume: '36,120 kg' },
]

const ACTIVITY = [
  { athlete: 'Alex Chen',   session: 'Push Day',   coach: 'Carlos Mendoza', date: 'Jun 30', volume: '3,280 kg', pr: true  },
  { athlete: 'Emma Wilson', session: 'Leg Day',    coach: 'Sarah Johnson',  date: 'Jun 29', volume: '4,100 kg', pr: false },
  { athlete: 'Jordan Lee',  session: 'Pull Day',   coach: 'Carlos Mendoza', date: 'Jun 28', volume: '2,850 kg', pr: false },
  { athlete: 'Ryan Park',   session: 'Upper Body', coach: 'Mike Torres',    date: 'Jun 28', volume: '3,100 kg', pr: false },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  unit,
  sub,
  up,
  icon: Icon,
}: {
  label: string
  value: string
  unit?: string
  sub: string | null
  up?: boolean
  icon: React.ElementType
}) {
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
          {unit && (
            <span className="ml-1.5 text-lg font-medium text-muted-foreground">{unit}</span>
          )}
        </p>
        {sub && (
          <p
            className={cn(
              'mt-1 text-xs font-medium',
              up === true  ? 'text-[color:var(--success)]' : 'text-muted-foreground',
            )}
          >
            {up && '↑ '}{sub}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Trainer row ───────────────────────────────────────────────────────────────

function TrainerRow({
  name,
  athletes,
  sessions,
  volume,
}: {
  name: string
  athletes: number
  sessions: number
  volume: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:bg-accent/30">
      {/* Avatar */}
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-sm text-primary-foreground">
        {initials(name)}
      </span>

      {/* Name */}
      <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">{name}</p>

      {/* Stats chips */}
      <div className="hidden items-center gap-2 sm:flex">
        <span className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-foreground tabular-nums">
          <span className="text-muted-foreground">Athletes </span>{athletes}
        </span>
        <span className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-foreground tabular-nums">
          <span className="text-muted-foreground">Sessions </span>{sessions}
        </span>
        <span className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-foreground tabular-nums">
          {volume}
        </span>
      </div>

      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" aria-hidden />
    </div>
  )
}

// ── Activity row ──────────────────────────────────────────────────────────────

function ActivityRow({
  athlete,
  session,
  coach,
  date,
  volume,
  pr,
}: {
  athlete: string
  session: string
  coach: string
  date: string
  volume: string
  pr: boolean
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:bg-accent/30">
      {/* Athlete avatar */}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
        {initials(athlete)}
      </span>

      {/* Details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{athlete}</p>
          {pr && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
              PR
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {session}{' '}
          <span className="mx-1 text-border">·</span>
          <span className="text-primary/80">Coach: {coach}</span>
        </p>
      </div>

      {/* Meta */}
      <div className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex">
        <p className="text-xs font-semibold tabular-nums text-foreground">{volume}</p>
        <p className="text-[10px] text-muted-foreground">{date}</p>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-6 backdrop-blur">
        <LayoutDashboard className="size-5 text-primary" aria-hidden />
        <div>
          <h1 className="text-base font-semibold text-foreground">Overview</h1>
          <p className="text-xs text-muted-foreground">Organization-wide training summary</p>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <main className="flex-1 space-y-6 p-6">

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {STATS.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        {/* Trainers section */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Trainers</h2>
          <div className="flex flex-col gap-2.5">
            {TRAINERS.map((t) => (
              <TrainerRow key={t.name} {...t} />
            ))}
          </div>
        </section>

        {/* Recent activity */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Recent activity</h2>
          <div className="flex flex-col gap-2.5">
            {ACTIVITY.map((a) => (
              <ActivityRow key={a.athlete + a.date} {...a} />
            ))}
          </div>
        </section>

      </main>
    </div>
  )
}
