'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Dumbbell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useSession } from '@/hooks/logs/use-session'
import type { LoggedExercise, LoggedSet } from '@/types/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(s: number): string {
  if (s >= 3600) {
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  }
  return `${Math.floor(s / 60)}m`
}

function setTypeLabel(type: string): string {
  const raw = type.replace(/_/g, ' ')
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function exerciseVolume(exercise: LoggedExercise): number {
  return exercise.logged_sets
    .filter((s) => s.counts_volume)
    .reduce((acc, s) => acc + s.weight_kg * s.reps, 0)
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
    </div>
  )
}

// ── Set row ───────────────────────────────────────────────────────────────────

function SetRow({ set, index }: { set: LoggedSet; index: number }) {
  return (
    <tr className="border-t border-border">
      <td className="py-1.5 pr-3 text-xs tabular-nums text-muted-foreground">
        {index + 1}
      </td>
      <td className="py-1.5 pr-3 text-xs text-foreground">
        {setTypeLabel(set.set_type)}
      </td>
      <td className="py-1.5 pr-3 text-xs tabular-nums text-foreground">
        {set.weight_kg} kg
      </td>
      <td className="py-1.5 pr-3 text-xs tabular-nums text-foreground">
        {set.reps}
      </td>
      {set.rpe != null ? (
        <td className="py-1.5 pr-3 text-xs tabular-nums text-foreground">
          {set.rpe}
        </td>
      ) : (
        <td className="py-1.5 pr-3 text-xs text-muted-foreground">—</td>
      )}
      <td className="py-1.5 text-xs text-foreground">
        {set.counts_volume ? (
          <span className="text-[color:var(--success)]">✓</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  )
}

// ── Exercise card ─────────────────────────────────────────────────────────────

function ExerciseCard({ exercise }: { exercise: LoggedExercise }) {
  const vol = exerciseVolume(exercise)
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-foreground">
          {exercise.exercise_name_free ?? 'Exercise'}
        </p>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          #{exercise.position}
        </span>
      </div>
      {exercise.logged_sets.length > 0 ? (
        <table className="w-full">
          <thead>
            <tr>
              <th className="pb-1.5 pr-3 text-left text-xs font-medium text-muted-foreground">
                #
              </th>
              <th className="pb-1.5 pr-3 text-left text-xs font-medium text-muted-foreground">
                Type
              </th>
              <th className="pb-1.5 pr-3 text-left text-xs font-medium text-muted-foreground">
                Weight
              </th>
              <th className="pb-1.5 pr-3 text-left text-xs font-medium text-muted-foreground">
                Reps
              </th>
              <th className="pb-1.5 pr-3 text-left text-xs font-medium text-muted-foreground">
                RPE
              </th>
              <th className="pb-1.5 text-left text-xs font-medium text-muted-foreground">
                Vol?
              </th>
            </tr>
          </thead>
          <tbody>
            {exercise.logged_sets.map((set, i) => (
              <SetRow key={set.id} set={set} index={i} />
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-muted-foreground">No sets recorded.</p>
      )}
      {vol > 0 && (
        <p className="mt-3 text-xs font-medium text-muted-foreground">
          Volume:{' '}
          <span className="tabular-nums text-foreground">
            {vol.toLocaleString()} kg
          </span>
        </p>
      )}
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-6 backdrop-blur">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
      </header>
      <main className="flex-1 space-y-6 p-6">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </main>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SessionSummaryPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const router = useRouter()
  const { sessionId } = use(params)
  const { data: session, isLoading, isError } = useSession(sessionId)

  if (isLoading) return <PageSkeleton />

  if (isError || !session) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <Dumbbell className="size-10 text-muted-foreground/40" />
        <p className="font-semibold text-foreground">Session not found</p>
        <p className="text-sm text-muted-foreground">
          This session does not exist or you don&apos;t have access to it.
        </p>
        <Button variant="outline" onClick={() => router.push('/logs/history')}>
          Back to history
        </Button>
      </div>
    )
  }

  const summary = session.summary
  const hasSets = session.logged_exercises.some(
    (ex) => ex.logged_sets.length > 0,
  )
  const setsByType = summary?.sets_by_type ?? {}

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-6 backdrop-blur">
        <button
          type="button"
          onClick={() => router.push('/logs/history')}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card transition-colors hover:bg-accent"
          aria-label="Back to history"
        >
          <ArrowLeft className="size-4 text-foreground" aria-hidden />
        </button>
        <div>
          <h1 className="text-base font-semibold text-foreground">
            {session.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            Completed ·{' '}
            {new Date(session.started_at).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
      </header>

      <main className="flex-1 space-y-6 p-6">
        {/* Summary stat cards */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            label="Duration"
            value={
              summary?.duration_seconds != null
                ? formatDuration(summary.duration_seconds)
                : '—'
            }
          />
          <StatCard
            label="Total volume"
            value={
              summary != null
                ? `${summary.total_volume_kg.toLocaleString()} kg`
                : '—'
            }
          />
          <StatCard
            label="Working sets"
            value={summary != null ? String(summary.working_sets_count) : '—'}
          />
          <StatCard
            label="Exercises"
            value={summary != null ? String(summary.exercises_count) : '—'}
          />
        </div>

        {/* Sets by type */}
        {hasSets && Object.keys(setsByType).length > 0 && (
          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">
              Sets by type
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(setsByType).map(([type, count]) => (
                <span
                  key={type}
                  className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                >
                  {setTypeLabel(type)}: {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Exercise list */}
        <div>
          <p className="mb-3 text-sm font-semibold text-foreground">
            Exercises logged
          </p>
          {session.logged_exercises.length > 0 ? (
            <div className="flex flex-col gap-3">
              {session.logged_exercises.map((ex) => (
                <ExerciseCard key={ex.id} exercise={ex} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Dumbbell className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No exercises were logged for this session.
              </p>
            </div>
          )}
        </div>

        {/* Bottom CTA */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Button onClick={() => router.push('/logs/new')}>
            Start another workout
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/logs/history')}
          >
            View all sessions
          </Button>
        </div>
      </main>
    </div>
  )
}
