import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Mock data ─────────────────────────────────────────────────────────────────

const ATHLETES = [
  {
    name:        'Alex Chen',
    email:       'alex@example.com',
    trainer:     'Carlos Mendoza',
    lastSession: 'Push Day · Jun 30 · 3,280 kg',
    active:      true,
  },
  {
    name:        'Emma Wilson',
    email:       'emma@example.com',
    trainer:     'Sarah Johnson',
    lastSession: 'Leg Day · Jun 29 · 4,100 kg',
    active:      true,
  },
  {
    name:        'Jordan Lee',
    email:       'jordan@example.com',
    trainer:     'Carlos Mendoza',
    lastSession: 'Pull Day · Jun 28 · 2,850 kg',
    active:      true,
  },
  {
    name:        'Ryan Park',
    email:       'ryan@example.com',
    trainer:     'Mike Torres',
    lastSession: 'Upper Body · Jun 28 · 3,100 kg',
    active:      true,
  },
  {
    name:        'Mia Santos',
    email:       'mia@example.com',
    trainer:     'Sarah Johnson',
    lastSession: '—',
    active:      false,
  },
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

// ── Athlete card ──────────────────────────────────────────────────────────────

function AthleteCard({
  name,
  email,
  trainer,
  lastSession,
  active,
}: {
  name: string
  email: string
  trainer: string
  lastSession: string
  active: boolean
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:bg-accent/30">
      {/* Avatar */}
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-sm text-primary-foreground">
        {initials(name)}
      </span>

      {/* Name + email */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{name}</p>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
            Trainer: {trainer}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{email}</p>
        <p className="mt-1 text-xs text-muted-foreground">{lastSession}</p>
      </div>

      {/* Status chip */}
      <span
        className={cn(
          'hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline-flex',
          active
            ? 'bg-[color:var(--success)]/10 text-[color:var(--success)]'
            : 'bg-secondary text-muted-foreground',
        )}
      >
        {active ? 'Active' : 'Inactive'}
      </span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AthletesPage() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <Users className="size-5 text-primary" aria-hidden />
          <h1 className="text-base font-semibold text-foreground">Athletes</h1>
        </div>
        <Button size="sm" disabled aria-label="Add athlete (coming soon)">
          Add athlete
        </Button>
      </header>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <main className="flex-1 space-y-3 p-6">
        {ATHLETES.map((a) => (
          <AthleteCard key={a.email} {...a} />
        ))}
      </main>
    </div>
  )
}
