'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Dumbbell, Swords, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useSession } from '@/hooks/logs/use-session'
import { useSessionBattle } from '@/hooks/logs/use-session-battle'
import { useAuthStore } from '@/lib/auth/store'
import { useI18n } from '@/providers/i18n-provider'
import type { LoggedExercise, LoggedSet, BattleParticipant } from '@/types/api'

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

// ── Battle result card ────────────────────────────────────────────────────────

function BattleResultCard({
  me,
  them,
  status,
}: {
  me: BattleParticipant
  them: BattleParticipant
  status: string
}) {
  const { t } = useI18n()
  const iWon = me.score > them.score
  const tied = me.score === them.score

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        status === 'finished'
          ? iWon
            ? 'border-[color:var(--success)]/40 bg-[color:var(--success)]/5'
            : tied
              ? 'border-border bg-muted/20'
              : 'border-destructive/30 bg-destructive/5'
          : 'border-border bg-card',
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <Swords className="size-4 text-primary" aria-hidden />
        <span className="text-sm font-semibold text-foreground">{t.battle.resultTitle}</span>
        {status === 'finished' && (
          <span
            className={cn(
              'ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold',
              iWon
                ? 'bg-[color:var(--success)]/10 text-[color:var(--success)]'
                : tied
                  ? 'bg-secondary text-muted-foreground'
                  : 'bg-destructive/10 text-destructive',
            )}
          >
            {iWon ? `🏆 ${t.battle.victory}` : tied ? t.battle.draw : t.battle.defeat}
          </span>
        )}
      </div>

      {/* Score comparison */}
      <div className="grid grid-cols-3 items-center gap-2 text-center">
        <div>
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {me.score.toFixed(0)}
          </p>
          <p className="text-[10px] text-muted-foreground">{t.battle.you}</p>
          {!me.body_weight_kg && (
            <p className="text-[9px] text-muted-foreground/60">{t.battle.rawVolNote}</p>
          )}
        </div>
        <div className="flex items-center justify-center">
          <span className="text-xs font-bold text-muted-foreground">{t.battle.vs}</span>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {them.score.toFixed(0)}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">{them.email.split('@')[0]}</p>
        </div>
      </div>

      {/* Per-exercise breakdown */}
      {(me.exercises.length > 0 || them.exercises.length > 0) && (() => {
        // Union of all exercise names from both sides
        const allNames = Array.from(
          new Set([
            ...me.exercises.map((e) => e.exercise_name),
            ...them.exercises.map((e) => e.exercise_name),
          ])
        )
        const meByName = Object.fromEntries(me.exercises.map((e) => [e.exercise_name, e]))
        const themByName = Object.fromEntries(them.exercises.map((e) => [e.exercise_name, e]))
        return (
        <div className="mt-3 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">{t.battle.colExercise}</th>
                <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">{t.battle.colReps}</th>
                <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">{t.battle.colWeight}</th>
                <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">{t.battle.colYou}</th>
                <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">{t.battle.colThem}</th>
              </tr>
            </thead>
            <tbody>
              {allNames.map((name) => {
                const myEx = meByName[name]
                const theirEx = themByName[name]
                const myS = myEx?.score ?? 0
                const theirS = theirEx?.score ?? 0
                const iWin = myS > 0 && myS >= theirS
                const theyWin = theirS > 0 && theirS > myS
                return (
                  <tr key={name} className="border-t border-border">
                    <td className="px-3 py-1.5 font-medium text-foreground">{name}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {myEx ? `${myEx.total_reps}` : theirEx ? `${theirEx.total_reps}` : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {myEx ? `${(myEx.total_weight_kg ?? 0).toFixed(0)} kg` : theirEx ? `${(theirEx.total_weight_kg ?? 0).toFixed(0)} kg` : '—'}
                    </td>
                    <td className={cn('px-3 py-1.5 text-right tabular-nums font-semibold', iWin ? 'text-[color:var(--success)]' : 'text-muted-foreground')}>
                      {myS > 0 ? myS.toFixed(0) : '—'}
                    </td>
                    <td className={cn('px-3 py-1.5 text-right tabular-nums font-semibold', theyWin ? 'text-[color:var(--success)]' : 'text-muted-foreground')}>
                      {theirS > 0 ? theirS.toFixed(0) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        )
      })()}
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
  const { t } = useI18n()
  const { sessionId } = use(params)
  const { data: session, isLoading, isError } = useSession(sessionId)
  const { data: battle } = useSessionBattle(sessionId)
  const currentUser = useAuthStore((s) => s.user)

  if (isLoading) return <PageSkeleton />

  if (isError || !session) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <Dumbbell className="size-10 text-muted-foreground/40" />
        <p className="font-semibold text-foreground">{t.battle.sessionNotFound}</p>
        <p className="text-sm text-muted-foreground">
          {t.battle.sessionNotFoundDesc}
        </p>
        <Button variant="outline" onClick={() => router.push('/logs/history')}>
          {t.battle.backToHistory}
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
            {t.battle.completed} ·{' '}
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
        {/* Battle result — shown when session was part of a battle */}
        {battle && (battle.status === 'finished' || battle.status === 'active') && (() => {
          const me: BattleParticipant =
            battle.opponent?.athlete_id === currentUser?.id
              ? battle.opponent!
              : battle.initiator
          const them: BattleParticipant | null =
            me.athlete_id === battle.initiator.athlete_id
              ? battle.opponent
              : battle.initiator
          if (!them) return null
          return (
            <BattleResultCard me={me} them={them} status={battle.status} />
          )
        })()}

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            label={t.battle.statDuration}
            value={
              summary?.duration_seconds != null
                ? formatDuration(summary.duration_seconds)
                : '—'
            }
          />
          <StatCard
            label={t.battle.statVolume}
            value={
              summary != null
                ? `${summary.total_volume_kg.toLocaleString()} kg`
                : '—'
            }
          />
          <StatCard
            label={t.battle.statWorkingSets}
            value={summary != null ? String(summary.working_sets_count) : '—'}
          />
          <StatCard
            label={t.battle.statExercises}
            value={summary != null ? String(summary.exercises_count) : '—'}
          />
        </div>

        {/* Sets by type */}
        {hasSets && Object.keys(setsByType).length > 0 && (
          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">
              {t.battle.setsByType}
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
            {t.battle.exercisesLogged}
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
                {t.battle.noExercisesLogged}
              </p>
            </div>
          )}
        </div>

        {/* Bottom CTA */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Button onClick={() => router.push('/logs/new')}>
            {t.battle.startAnother}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/logs/history')}
          >
            {t.battle.viewAll}
          </Button>
        </div>
      </main>
    </div>
  )
}
