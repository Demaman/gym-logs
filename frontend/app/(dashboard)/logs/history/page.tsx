'use client'

import { useRouter } from 'next/navigation'
import { Dumbbell, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useSessionHistory } from '@/hooks/logs/use-session-history'
import type { WorkoutSession } from '@/types/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(s: number): string {
  if (s >= 3600) {
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  }
  return `${Math.floor(s / 60)}m`
}

function dayTagLabel(mode: WorkoutSession['mode']): string {
  return mode === 'program_driven' ? 'Program' : 'Free'
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
        <Skeleton className="h-4 w-12 rounded" />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
      </div>
      <Skeleton className="mt-2 h-3 w-48 rounded" />
    </div>
  )
}

// ── Session card ──────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onClick,
}: {
  session: WorkoutSession
  onClick: () => void
}) {
  const duration = session.summary?.duration_seconds ?? 0
  const volume = session.summary?.total_volume_kg ?? 0

  const exercisesPreview = (() => {
    const names = session.logged_exercises
      .slice(0, 3)
      .map((ex) => ex.exercise_name_free ?? 'Exercise')
    const extra = session.logged_exercises.length - 3
    return extra > 0 ? `${names.join(' · ')} +${extra} more` : names.join(' · ')
  })()

  const dateLabel = new Date(session.started_at).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick()
      }}
      className={cn(
        'rounded-xl border border-border bg-card p-5',
        'cursor-pointer transition-colors hover:bg-accent/30',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {dayTagLabel(session.mode)}
          </span>
          <p className="truncate text-sm font-semibold text-foreground">
            {session.name}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
            {formatDuration(duration)}
          </span>
          <ChevronRight className="size-4 text-muted-foreground/50" aria-hidden />
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{dateLabel}</p>
        <span className="shrink-0 text-xs tabular-nums font-medium text-foreground">
          {volume.toLocaleString()} kg
        </span>
      </div>
      {exercisesPreview && (
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {exercisesPreview}
        </p>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SessionHistoryPage() {
  const router = useRouter()
  const { data, isLoading } = useSessionHistory({ limit: 20 })

  const sessions = data ?? []

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
        <div>
          <h1 className="text-base font-semibold text-foreground">
            Session history
          </h1>
          <p className="text-xs text-muted-foreground">
            All your completed workouts
          </p>
        </div>
        <Button size="sm" onClick={() => router.push('/logs/new')}>
          Start workout
        </Button>
      </header>

      <main className="flex-1 p-6">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Dumbbell className="size-10 text-muted-foreground/40" />
            <p className="font-semibold text-foreground">No sessions yet</p>
            <p className="text-sm text-muted-foreground">
              Start your first workout to begin tracking progress.
            </p>
            <Button onClick={() => router.push('/logs/new')}>
              Start a workout
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((session: WorkoutSession) => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() => router.push(`/logs/${session.id}/summary`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
