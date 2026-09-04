'use client'

import { Fragment, useState, useEffect, useRef, useMemo, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  X,
  Plus,
  Loader2,
  Search,
  Dumbbell,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Timer,
  MoreHorizontal,
  ClipboardList,
  Play,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useSession } from '@/hooks/logs/use-session'
import { useFinishSession } from '@/hooks/logs/use-finish-session'
import { useFinishAthleteSession } from '@/hooks/logs/use-finish-athlete-session'
import { useAuthStore } from '@/lib/auth/store'
import { useUpdateSession } from '@/hooks/logs/use-update-session'
import { useDiscardSession } from '@/hooks/logs/use-discard-session'
import { useAddExercise, useDeleteExercise } from '@/hooks/logs/use-exercise-log'
import { useAddSet, useDeleteSet } from '@/hooks/logs/use-log-set'
import { useExerciseSearch } from '@/hooks/training/use-exercises'
import { useExerciseLastSession } from '@/hooks/logs/use-exercise-history'
import { usePrograms } from '@/hooks/training/use-programs'
import { useI18n } from '@/providers/i18n-provider'
import { ExerciseVideoModal, VideoPreviewButton } from '@/components/training/exercise-video-modal'
import { BattleStrip } from '@/components/logs/battle-strip'
import { BattleInitiateModal } from '@/components/logs/battle-initiate-modal'
import { useSessionBattle } from '@/hooks/logs/use-session-battle'
import { Swords } from 'lucide-react'
import type { WorkoutSession, LoggedExercise, LoggedSet, SetType, ExerciseLastSession, DayTag, PrescribedSetTarget } from '@/types/api'

// ── Volume helper ─────────────────────────────────────────────────────────────

function computeVolume(session: WorkoutSession): number {
  return session.logged_exercises
    .flatMap((ex) => ex.logged_sets)
    .filter((s) => s.counts_volume)
    .reduce((sum, s) => sum + s.weight_kg * s.reps, 0)
}

function formatVolume(kg: number): string {
  return kg.toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' kg'
}

// ── Date/session label ────────────────────────────────────────────────────────

function sessionLabel(session: WorkoutSession): string {
  const parts: string[] = []
  if (session.name) {
    parts.push(session.name)
  }
  const date = new Date(session.started_at)
  const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  parts.push(monthDay)
  return parts.join(' · ')
}

// ── CountUpTimer — reusable count-up from a start timestamp ──────────────────

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

// ── RestTimerBanner ───────────────────────────────────────────────────────────

interface RestTimerBannerProps {
  startedAt: Date | null
  onStop: (elapsed: number) => void
}

function RestTimerBanner({ startedAt, onStop }: RestTimerBannerProps) {
  const { t } = useI18n()
  const elapsed = useCountUp(startedAt)
  if (!startedAt) return null

  const color =
    elapsed < 60  ? 'bg-emerald-500' :
    elapsed < 90  ? 'bg-yellow-500' :
    elapsed < 120 ? 'bg-orange-500' :
                    'bg-destructive'

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
      <span className={cn('size-2.5 shrink-0 rounded-full animate-pulse', color)} aria-hidden />
      <span className="text-xs font-medium text-muted-foreground">{t.logs.resting}</span>
      <span className="flex-1 text-center text-lg font-bold tabular-nums text-foreground">
        {formatCountUp(elapsed)}
      </span>
      <button
        type="button"
        onClick={() => onStop(elapsed)}
        aria-label="Stop rest timer"
        className={cn(
          'rounded-lg px-3 py-1 text-xs font-semibold transition-colors',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        {t.logs.restDone}
      </button>
    </div>
  )
}

// ── SetTypeBadge ──────────────────────────────────────────────────────────────

const SET_TYPE_STYLES: Record<string, string> = {
  warm_up:  'bg-blue-100 text-blue-700',
  working:  'bg-primary/10 text-primary',
  top_set:  'bg-yellow-100 text-yellow-700',
  back_off: 'bg-purple-100 text-purple-700',
  failure:  'bg-red-100 text-red-700',
  drop_set: 'bg-orange-100 text-orange-700',
  feeder:   'bg-gray-100 text-gray-600',
}

function SetTypeBadge({ type }: { type: SetType }) {
  const { t } = useI18n()
  const styles = SET_TYPE_STYLES[type] ?? 'bg-secondary text-muted-foreground'
  const translated = (t.logs.setTypes as Record<string, string>)[type]
  const label = translated ?? type.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', styles)}>
      {label}
    </span>
  )
}

// ── AddSetForm ────────────────────────────────────────────────────────────────

const SET_TYPE_CHIPS: SetType[] = [
  'warm_up', 'feeder', 'working', 'back_off', 'top_set', 'failure', 'drop_set',
]

interface AddSetFormProps {
  sessionId: string
  exerciseId: string
  onAfterLog?: (setSeconds: number) => void
}

function AddSetForm({ sessionId, exerciseId, onAfterLog }: AddSetFormProps) {
  const { t } = useI18n()
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [setType, setSetType] = useState<SetType>('working')
  const [showRpe, setShowRpe] = useState(false)
  const [rpe, setRpe] = useState('')

  const addSet = useAddSet(sessionId, exerciseId)

  const weightNum = parseFloat(weight)
  const repsNum = parseInt(reps, 10)
  const isValid = weightNum > 0 && repsNum > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return

    addSet.mutate(
      {
        set_type: setType,
        weight_kg: weightNum,
        reps: repsNum,
        rpe: showRpe && rpe ? parseFloat(rpe) : undefined,
      },
      {
        onSuccess: () => {
          setWeight('')
          setReps('')
          setRpe('')
          onAfterLog?.(0)
        },
      },
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 rounded-lg border border-border bg-background/60 p-3"
      aria-label={t.logs.logSet}
    >
      {/* Set type chips */}
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {SET_TYPE_CHIPS.map((chip) => {
          const translated = (t.logs.setTypes as Record<string, string>)[chip]
          const label = translated ?? chip.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
          return (
            <button
              key={chip}
              type="button"
              onClick={() => setSetType(chip)}
              aria-pressed={setType === chip}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                setType === chip
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground hover:bg-secondary/70',
              )}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Inputs row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          type="number"
          inputMode="decimal"
          placeholder="e.g. 80"
          aria-label="Weight (kg)"
          min={0}
          step={0.5}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="w-24"
          required
        />
        <span className="text-xs font-medium text-muted-foreground">kg</span>

        <Input
          type="number"
          inputMode="numeric"
          placeholder="e.g. 8"
          aria-label="Reps"
          min={1}
          step={1}
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          className="w-20"
          required
        />
        <span className="text-xs font-medium text-muted-foreground">reps</span>

        {showRpe && (
          <>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="RPE"
              aria-label="RPE (1–10)"
              min={1}
              max={10}
              step={0.5}
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              className="w-16"
            />
          </>
        )}

        <button
          type="button"
          onClick={() => setShowRpe((v) => !v)}
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
        >
          {showRpe ? t.logs.hideRpe : t.logs.rpeQuestion}
        </button>
      </div>

      {/* Footer: submit */}
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={!isValid || addSet.isPending}
          aria-label={t.logs.logSet}
        >
          {addSet.isPending ? (
            <>
              <Loader2 className="size-3 animate-spin" aria-hidden />
              {t.logs.loggingSet}
            </>
          ) : (
            t.logs.logSet
          )}
        </Button>
      </div>
    </form>
  )
}

// ── ReferencePanel (program targets + last session — compact, mobile-first) ───

function ReferencePanel({
  prescribed,
  last,
}: {
  prescribed: PrescribedSetTarget[]
  last: ExerciseLastSession | undefined
}) {
  const { t } = useI18n()
  const [showAvg, setShowAvg] = useState(false)

  if (prescribed.length === 0 && !last) return null

  const dateStr = last
    ? new Date(last.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  const maxRows = Math.max(prescribed.length, last?.sets.length ?? 0)

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-border/60 bg-secondary/30 px-2.5 py-2">
      {/*
        Single flat grid — header + all data rows share one column-sizing context.
        auto tracks are sized to the widest cell across every row, so columns
        always align and nothing ever stretches across the card.
      */}
      <div className="grid grid-cols-[16px_90px_max-content] items-center gap-x-2 gap-y-0.5">
        {/* Header row */}
        <span />
        <span className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-primary/80">
          {prescribed.length > 0 ? t.logs.targets : ''}
        </span>
        <div className="flex items-center gap-1 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {last ? `${t.logs.last} · ${dateStr}` : ''}
          </span>
          {last && (
            <button
              type="button"
              onClick={() => setShowAvg((v) => !v)}
              aria-label={showAvg ? t.logs.hideAvg : t.logs.showAvg}
              className={cn(
                'shrink-0 rounded p-0.5 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                showAvg
                  ? 'text-primary'
                  : 'text-muted-foreground/40 hover:text-muted-foreground',
              )}
            >
              <MoreHorizontal className="size-3.5" aria-hidden />
            </button>
          )}
        </div>

        {/* Data rows — Fragment keeps each row's 3 cells in the same grid */}
        {Array.from({ length: maxRows }).map((_, i) => {
          const p = prescribed[i]
          const l = last?.sets[i]
          return (
            <Fragment key={i}>
              <span className="text-right text-[10px] tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <span className="text-xs">
                {p && (
                  <>
                    <span className="font-medium text-foreground">
                      {p.rep_min === p.rep_max ? p.rep_min : `${p.rep_min}–${p.rep_max}`}
                      <span className="text-muted-foreground">r</span>
                    </span>
                    {p.rpe_target != null && (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        RPE {p.rpe_target}
                      </span>
                    )}
                  </>
                )}
              </span>
              <span className="tabular-nums text-[11px] text-muted-foreground">
                {l && (
                  <>
                    {l.weight_kg}
                    <span className="text-[9px]">kg</span>×{l.reps}
                    {l.rpe != null && (
                      <span className="ml-0.5 text-[10px]">RPE {l.rpe}</span>
                    )}
                  </>
                )}
              </span>
            </Fragment>
          )
        })}
      </div>

      {/* Average stats (expandable) */}
      {showAvg && last?.average && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border/50 px-2.5 py-1.5">
          {last.average.weight_kg != null && (
            <span className="text-[10px]">
              <span className="font-semibold tabular-nums text-foreground">
                {last.average.weight_kg.toFixed(1)}
              </span>
              <span className="text-muted-foreground"> {t.logs.avgKg}</span>
            </span>
          )}
          {last.average.reps != null && (
            <span className="text-[10px]">
              <span className="font-semibold tabular-nums text-foreground">
                {last.average.reps.toFixed(1)}
              </span>
              <span className="text-muted-foreground"> {t.logs.avgReps}</span>
            </span>
          )}
          {last.average.rpe != null && (
            <span className="text-[10px]">
              <span className="font-semibold tabular-nums text-foreground">
                {last.average.rpe.toFixed(1)}
              </span>
              <span className="text-muted-foreground"> RPE</span>
            </span>
          )}
          <span className="text-[10px]">
            <span className="font-semibold tabular-nums text-foreground">
              {last.average.total_volume_kg.toFixed(0)}
            </span>
            <span className="text-muted-foreground"> kg vol</span>
          </span>
        </div>
      )}
    </div>
  )
}

// ── ExerciseBlock ─────────────────────────────────────────────────────────────

interface ExerciseBlockProps {
  exercise: LoggedExercise
  sessionId: string
  onStartRest: () => void
  onLogSet?: (setSeconds: number) => void
  demoVideoUrl?: string | null
}

function ExerciseBlock({ exercise, sessionId, onStartRest, onLogSet, demoVideoUrl }: ExerciseBlockProps) {
  const { t } = useI18n()
  const [showAddSet, setShowAddSet] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const deleteExercise = useDeleteExercise(sessionId)
  const { data: lastSession } = useExerciseLastSession(exercise.exercise_id)

  const name = exercise.exercise_name_free ?? `Exercise #${exercise.position + 1}`

  return (
    <>
    <div className="rounded-xl border border-border bg-card p-5">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{name}</h3>
        <div className="flex items-center gap-0.5">
          {demoVideoUrl && (
            <button
              type="button"
              aria-label={`${t.training.watchDemo}: ${name}`}
              onClick={() => setShowVideo(true)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <Play className="size-3.5 shrink-0" aria-hidden />
              {t.training.watchDemo}
            </button>
          )}
          <button
            type="button"
            aria-label={`${t.logs.removeExercise}: ${name}`}
            disabled={deleteExercise.isPending}
            onClick={() => deleteExercise.mutate(exercise.id)}
            className={cn(
              'rounded-md p-1 text-muted-foreground transition-colors',
              'hover:bg-destructive/10 hover:text-destructive',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          >
            {deleteExercise.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <X className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* Program targets + last session — combined compact reference */}
      <ReferencePanel prescribed={exercise.prescribed_sets} last={lastSession ?? undefined} />

      {/* Set rows */}
      {exercise.logged_sets.length > 0 && (
        <div className="mb-2 flex flex-col gap-1.5">
          {exercise.logged_sets.map((set) => (
            <SetRow
              key={set.id}
              set={set}
              sessionId={sessionId}
              exerciseId={exercise.id}
            />
          ))}
        </div>
      )}

      {/* Add set toggle */}
      {showAddSet ? (
        <div>
          <AddSetForm
            sessionId={sessionId}
            exerciseId={exercise.id}
            onAfterLog={(dur) => {
              onStartRest()
              onLogSet?.(dur)
            }}
          />
          <button
            type="button"
            onClick={() => setShowAddSet(false)}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronUp className="size-3" aria-hidden />
            {t.logs.doneAddingSets}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddSet(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary transition-opacity hover:opacity-70"
        >
          <Plus className="size-3" aria-hidden />
          {t.logs.addSet}
        </button>
      )}
    </div>
    {showVideo && demoVideoUrl && (
      <ExerciseVideoModal url={demoVideoUrl} exerciseName={name} onClose={() => setShowVideo(false)} />
    )}
    </>
  )
}

// ── SetRow ────────────────────────────────────────────────────────────────────

interface SetRowProps {
  set: LoggedSet
  sessionId: string
  exerciseId: string
}

function SetRow({ set, sessionId, exerciseId }: SetRowProps) {
  const { t } = useI18n()
  const deleteSet = useDeleteSet(sessionId, exerciseId, set.id)

  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary/50 transition-colors group">
      <SetTypeBadge type={set.set_type} />
      <span className="flex-1 text-sm tabular-nums text-foreground">
        {set.weight_kg} kg × {set.reps} reps
        {set.rpe != null && (
          <span className="ml-1.5 text-xs text-muted-foreground">@ RPE {set.rpe}</span>
        )}
      </span>
      <button
        type="button"
        aria-label={t.logs.removeSet}
        disabled={deleteSet.isPending}
        onClick={() => deleteSet.mutate()}
        className={cn(
          'rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all',
          'hover:bg-destructive/10 hover:text-destructive',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:opacity-100',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        {deleteSet.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <X className="size-3.5" aria-hidden />
        )}
      </button>
    </div>
  )
}

// ── AddExerciseDrawer ─────────────────────────────────────────────────────────

const DAY_TAG_GROUPS: Record<string, string[]> = {
  push:      ['chest', 'shoulders', 'triceps'],
  pull:      ['back', 'biceps'],
  chest:     ['chest'],
  back:      ['back'],
  shoulders: ['shoulders'],
  arms:      ['biceps', 'triceps', 'forearms'],
  legs:      ['quads', 'hamstrings', 'glutes', 'calves'],
  glutes:    ['glutes', 'hamstrings'],
  core:      ['core'],
  upper:     ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  lower:     ['quads', 'hamstrings', 'glutes', 'calves'],
  full_body: ['full_body', 'chest', 'back', 'quads'],
  cardio:    ['core', 'full_body'],
}

const ALL_DAY_TAGS: DayTag[] = [
  'push', 'pull', 'chest', 'back', 'shoulders', 'arms',
  'legs', 'glutes', 'core', 'upper', 'lower', 'full_body', 'cardio', 'custom',
]

interface AddExerciseDrawerProps {
  sessionId: string
  dayTag: string | null
  open: boolean
  onClose: () => void
}

function AddExerciseDrawer({ sessionId, dayTag, open, onClose }: AddExerciseDrawerProps) {
  const { t } = useI18n()
  const groups: string[] = dayTag ? (DAY_TAG_GROUPS[dayTag] ?? []) : []

  const [query, setQuery] = useState('')
  const [activeGroup, setActiveGroup] = useState<string | null>(groups[0] ?? null)
  const [customName, setCustomName] = useState('')
  // Track which row is being added so we can show a spinner on it
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addingCustom, setAddingCustom] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)
  const customRef = useRef<HTMLInputElement>(null)

  const isSearching = query.trim().length > 0

  const { data: searchResults = [], isFetching: searchFetching } = useExerciseSearch(
    { query: query.trim(), limit: 12 },
    { enabled: isSearching },
  )
  const { data: groupResults = [] } = useExerciseSearch(
    { muscle_group: activeGroup as import('@/types/api').MuscleGroup | undefined, limit: 15 },
    { enabled: !isSearching && activeGroup !== null },
  )

  const exercises = isSearching ? searchResults : groupResults

  const addExercise = useAddExercise(sessionId)

  useEffect(() => {
    if (open) {
      setQuery('')
      setCustomName('')
      setAddingId(null)
      setAddingCustom(false)
      setActiveGroup(groups[0] ?? null)
      setTimeout(() => searchRef.current?.focus(), 50)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  function addFromCatalog(id: string, name: string) {
    setAddingId(id)
    addExercise.mutate(
      // Store both ID (for FK) and name (so card always renders correctly)
      { exercise_id: id, exercise_name_free: name },
      { onSuccess: () => onClose(), onError: () => setAddingId(null) },
    )
  }

  function addCustom() {
    const name = customName.trim()
    if (!name) return
    setAddingCustom(true)
    addExercise.mutate(
      { exercise_name_free: name },
      { onSuccess: () => onClose(), onError: () => setAddingCustom(false) },
    )
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Drawer sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add exercise"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col rounded-t-2xl bg-background shadow-2xl"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-border" aria-hidden />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-1">
          <h2 className="text-base font-semibold text-foreground">{t.logs.addExercise}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className={cn(
              'rounded-lg p-1.5 text-muted-foreground transition-colors',
              'hover:bg-secondary hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {/* Search */}
        <div className="shrink-0 px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            {searchFetching && (
              <Loader2 className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
            )}
            <Input
              ref={searchRef}
              type="text"
              placeholder={t.logs.searchCatalog}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 pr-9"
              aria-label={t.logs.searchCatalog}
            />
          </div>
        </div>

        {/* Muscle-group pills */}
        {!isSearching && groups.length > 0 && (
          <div
            className="flex shrink-0 gap-2 overflow-x-auto px-5 pb-3"
            role="group"
            aria-label={t.logs.filterByMuscle}
          >
            {groups.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setActiveGroup(g)}
                aria-pressed={activeGroup === g}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  activeGroup === g
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-secondary text-foreground hover:bg-secondary/70',
                )}
              >
                {(t.training.muscleGroups as Record<string, string>)[g] ?? g}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable catalog results */}
        <div className="flex-1 overflow-y-auto px-2">
          {exercises.length > 0 ? (
            <ul className="flex flex-col pb-1" role="listbox" aria-label="Exercise results">
              {exercises.map((ex) => {
                const isAdding = addingId === ex.id
                return (
                  <li key={ex.id} role="option" aria-selected={false} className="flex items-center">
                    <button
                      type="button"
                      disabled={!!addingId || addingCustom}
                      onClick={() => {
                        // Include equipment so "Bench Press (Barbell)" and
                        // "Bench Press (Dumbbell)" are distinct on the workout card.
                        const eqLabel = (t.training.equipment as Record<string, string>)[ex.equipment] ?? ex.equipment
                        const label = `${ex.name} (${eqLabel})`
                        addFromCatalog(ex.id, label)
                      }}
                      className={cn(
                        'group flex flex-1 items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                        'disabled:pointer-events-none',
                        isAdding ? 'bg-primary/8' : 'hover:bg-secondary/80 active:bg-secondary',
                      )}
                    >
                      {/* Equipment icon area */}
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors',
                          isAdding
                            ? 'bg-primary/15 text-primary'
                            : 'bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary',
                        )}
                        aria-hidden
                      >
                        {isAdding
                          ? <Loader2 className="size-4 animate-spin" />
                          : ((t.training.equipment as Record<string, string>)[ex.equipment] ?? ex.equipment).slice(0, 2)
                        }
                      </div>

                      {/* Name + muscle group */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{ex.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {(t.training.equipment as Record<string, string>)[ex.equipment] ?? ex.equipment}
                          <span className="mx-1.5 text-border">·</span>
                          {(t.training.muscleGroups as Record<string, string>)[ex.muscle_group] ?? ex.muscle_group}
                        </p>
                      </div>

                      {/* Chevron */}
                      {!isAdding && (
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" aria-hidden />
                      )}
                    </button>
                    {ex.demo_video_url && (
                      <VideoPreviewButton url={ex.demo_video_url} name={ex.name} />
                    )}
                  </li>
                )
              })}
            </ul>
          ) : isSearching ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              {t.logs.noResultsFor} &ldquo;{query.trim()}&rdquo; — {t.logs.searchAboveOrCustom}
            </p>
          ) : groups.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              {t.logs.searchAboveOrCustom}
            </p>
          ) : null}
        </div>

        {/* ── Custom exercise ── always visible ─────────────────────────────── */}
        <div className="shrink-0 border-t border-border bg-background px-5 pb-20 pt-4 lg:pb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t.logs.customExercise}
          </p>
          <div className="flex gap-2">
            <Input
              ref={customRef}
              type="text"
              placeholder={t.logs.customExercisePlaceholder}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addCustom() }}
              disabled={addingCustom || !!addingId}
              aria-label={t.logs.customExercise}
              className="flex-1"
            />
            <Button
              size="icon"
              disabled={!customName.trim() || addingCustom || !!addingId}
              onClick={addCustom}
              aria-label={t.logs.addCustomExercise}
              className="shrink-0"
            >
              {addingCustom
                ? <Loader2 className="size-4 animate-spin" aria-hidden />
                : <Plus className="size-4" aria-hidden />
              }
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── DiscardDialog ─────────────────────────────────────────────────────────────

interface DiscardDialogProps {
  sessionId: string
  open: boolean
  onClose: () => void
}

function DiscardDialog({ sessionId, open, onClose }: DiscardDialogProps) {
  const { t } = useI18n()
  const router = useRouter()
  const discard = useDiscardSession(sessionId)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Discard workout"
        className="fixed inset-x-4 bottom-20 z-50 rounded-2xl border border-border bg-background p-5 shadow-xl lg:bottom-4 sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-sm sm:-translate-x-1/2"
      >
        <h2 className="text-base font-semibold text-foreground">{t.logs.discardWorkout}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.logs.discardConfirm}
        </p>
        <div className="mt-5 flex gap-2.5">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t.logs.keepIt}
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={discard.isPending}
            onClick={() =>
              discard.mutate(undefined, {
                onSuccess: () => router.push('/logs'),
              })
            }
          >
            {discard.isPending ? (
              <><Loader2 className="size-4 animate-spin" aria-hidden />{t.logs.discarding}</>
            ) : (
              t.logs.discard
            )}
          </Button>
        </div>
      </div>
    </>
  )
}

// ── TagPickerDrawer ───────────────────────────────────────────────────────────

interface TagPickerDrawerProps {
  sessionId: string
  currentTag: DayTag | null
  open: boolean
  onClose: () => void
}

function TagPickerDrawer({ sessionId, currentTag, open, onClose }: TagPickerDrawerProps) {
  const { t } = useI18n()
  const update = useUpdateSession(sessionId)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  function pick(tag: DayTag) {
    if (tag === currentTag) { onClose(); return }
    update.mutate({ day_tag: tag }, { onSuccess: onClose })
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Change day tag"
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-background shadow-2xl"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" aria-hidden />
        </div>
        <div className="flex items-center justify-between px-5 pb-3 pt-1">
          <h2 className="text-base font-semibold text-foreground">{t.logs.changeDayTag}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className={cn(
              'rounded-lg p-1.5 text-muted-foreground transition-colors',
              'hover:bg-secondary hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="flex flex-wrap gap-2.5 px-5 pb-20 lg:pb-8">
          {ALL_DAY_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              disabled={update.isPending}
              onClick={() => pick(tag)}
              aria-pressed={tag === currentTag}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:pointer-events-none disabled:opacity-60',
                tag === currentTag
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground hover:bg-secondary/70',
              )}
            >
              {(t.logs.dayTags as Record<string, string>)[tag] ?? tag}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

// ── LinkProgramDrawer ─────────────────────────────────────────────────────────

interface LinkProgramDrawerProps {
  sessionId: string
  currentProgramDayId: string | null
  open: boolean
  onClose: () => void
}

function LinkProgramDrawer({
  sessionId,
  currentProgramDayId,
  open,
  onClose,
}: LinkProgramDrawerProps) {
  const { t } = useI18n()
  const update = useUpdateSession(sessionId)
  const { data: programs = [], isLoading } = usePrograms()

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  function link(dayId: string) {
    if (dayId === currentProgramDayId) { onClose(); return }
    update.mutate({ program_day_id: dayId }, { onSuccess: onClose })
  }

  function unlink() {
    update.mutate({ program_day_id: null }, { onSuccess: onClose })
  }

  const isLinked = currentProgramDayId !== null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Link to program day"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[75vh] flex-col rounded-t-2xl bg-background shadow-2xl"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-border" aria-hidden />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-1">
          <h2 className="text-base font-semibold text-foreground">{t.logs.linkToProgram}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className={cn(
              'rounded-lg p-1.5 text-muted-foreground transition-colors',
              'hover:bg-secondary hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          {isLoading ? (
            <div className="flex flex-col gap-2 py-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-secondary" />
              ))}
            </div>
          ) : programs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <ClipboardList className="size-10 text-muted-foreground/40" aria-hidden />
              <p className="font-semibold text-foreground">{t.training.noPrograms}</p>
              <p className="text-sm text-muted-foreground">
                {t.logs.noProgramsYetLinkDesc}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5 py-1">
              {programs.map((program) => (
                <div key={program.id}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {program.name}
                  </p>
                  {program.days.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-1">{t.training.noDays}</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {program.days.map((day) => {
                        const isSelected = day.id === currentProgramDayId
                        return (
                          <button
                            key={day.id}
                            type="button"
                            disabled={update.isPending}
                            onClick={() => link(day.id)}
                            aria-pressed={isSelected}
                            className={cn(
                              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              'disabled:pointer-events-none disabled:opacity-60',
                              isSelected
                                ? 'bg-primary/10'
                                : 'hover:bg-secondary/80 active:bg-secondary',
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <p
                                className={cn(
                                  'truncate text-sm font-medium',
                                  isSelected ? 'text-primary' : 'text-foreground',
                                )}
                              >
                                {day.name}
                              </p>
                            </div>
                            <span
                              className={cn(
                                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                isSelected
                                  ? 'bg-primary/20 text-primary'
                                  : 'bg-secondary text-muted-foreground',
                              )}
                            >
                              {(t.logs.dayTags as Record<string, string>)[day.day_tag] ?? day.day_tag}
                            </span>
                            {isSelected && update.isPending ? (
                              <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
                            ) : isSelected ? (
                              <div
                                className="size-4 shrink-0 rounded-full bg-primary"
                                aria-label="Currently linked"
                              />
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unlink footer */}
        {isLinked && (
          <div className="shrink-0 border-t border-border px-5 pb-20 pt-3 lg:pb-3">
            <button
              type="button"
              disabled={update.isPending}
              onClick={unlink}
              className={cn(
                'text-sm font-medium text-destructive transition-colors',
                'hover:text-destructive/80 disabled:opacity-50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              {update.isPending ? t.logs.removingProgramLink : t.logs.removeProgramLink}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ── FinishDialog ──────────────────────────────────────────────────────────────

interface FinishDialogProps {
  sessionId: string
  athleteId?: string
  open: boolean
  onClose: () => void
}

function FinishDialog({ sessionId, athleteId, open, onClose }: FinishDialogProps) {
  const { t } = useI18n()
  const router = useRouter()
  const [difficulty, setDifficulty] = useState<number | ''>('')
  const [notes, setNotes] = useState('')

  const finishOwn = useFinishSession(sessionId)
  const finishAthlete = useFinishAthleteSession(athleteId ?? '', sessionId)
  const finish = athleteId ? finishAthlete : finishOwn

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  function handleFinish() {
    finish.mutate(
      {
        perceived_difficulty: difficulty !== '' ? Number(difficulty) : undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          router.push(`/logs/${sessionId}/summary`)
        },
      },
    )
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Finish workout"
        className="fixed inset-x-4 bottom-20 z-50 rounded-2xl border border-border bg-background p-5 shadow-xl lg:bottom-4 sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-sm sm:-translate-x-1/2"
      >
        <h2 className="text-base font-semibold text-foreground">{t.logs.finishWorkout}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t.logs.finishOptionalFields}
        </p>

        <div className="mt-4 flex flex-col gap-4">
          {/* Perceived difficulty */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="difficulty"
              className="flex items-center gap-1 text-xs font-semibold text-foreground"
            >
              {t.logs.perceivedDifficulty}
              <span className="font-normal text-muted-foreground">{t.logs.difficultyHint}</span>
            </label>
            <Input
              id="difficulty"
              type="number"
              inputMode="numeric"
              placeholder="e.g. 7"
              min={1}
              max={10}
              step={1}
              value={difficulty}
              onChange={(e) => {
                const v = e.target.value
                setDifficulty(v === '' ? '' : Math.min(10, Math.max(1, parseInt(v, 10))))
              }}
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="finish-notes"
              className="text-xs font-semibold text-foreground"
            >
              {t.logs.sessionNotes}
            </label>
            <textarea
              id="finish-notes"
              placeholder={t.logs.sessionNotesPlaceholder}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={cn(
                'w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground',
                'placeholder:text-muted-foreground',
                'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring',
                'transition-colors duration-150',
              )}
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2.5">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            className="flex-1"
            disabled={finish.isPending}
            onClick={handleFinish}
          >
            {finish.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t.logs.finishing}
              </>
            ) : (
              t.logs.finishButton
            )}
          </Button>
        </div>
      </div>
    </>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SessionSkeleton() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Header skeleton */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background px-6">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-secondary" />
        <div className="h-4 w-40 animate-pulse rounded bg-secondary" />
        <div className="ml-auto h-8 w-20 animate-pulse rounded-lg bg-secondary" />
      </div>
      {/* Subheader skeleton */}
      <div className="flex h-10 items-center gap-4 border-b border-border bg-background/60 px-6">
        <div className="h-3 w-24 animate-pulse rounded bg-secondary" />
        <div className="h-3 w-28 animate-pulse rounded bg-secondary" />
      </div>
      {/* Exercise skeletons */}
      <div className="flex flex-col gap-3 p-6">
        {[1, 2].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-secondary" />
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ActiveSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const router = useRouter()
  const { sessionId } = use(params)
  const { t } = useI18n()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [linkProgramOpen, setLinkProgramOpen] = useState(false)
  const [battleOpen, setBattleOpen] = useState(false)
  const [restStartedAt, setRestStartedAt] = useState<Date | null>(null)
  const [totalRestSeconds, setTotalRestSeconds] = useState(0)
  const [totalLoggedWorkSeconds, setTotalLoggedWorkSeconds] = useState(0)

  const currentUser = useAuthStore((s) => s.user)
  const { data: session, isLoading, error } = useSession(sessionId)
  const { data: battle } = useSessionBattle(sessionId)

  // When the session belongs to a different user (trainer managing athlete's session)
  const isTrainerSession =
    !!session &&
    !!currentUser &&
    session.athlete_id !== currentUser.id
  const { data: programs = [] } = usePrograms()

  // Resolve linked program day name from cached programs list
  const linkedDay = useMemo(() => {
    if (!session?.program_day_id) return null
    for (const p of programs) {
      const day = p.days.find((d) => d.id === session.program_day_id)
      if (day) return day
    }
    return null
  }, [programs, session?.program_day_id])

  // Session elapsed — page-level so we can derive working / resting metrics
  const [sessionSeconds, setSessionSeconds] = useState(0)
  useEffect(() => {
    if (!session) return
    const origin = new Date(session.started_at).getTime()
    setSessionSeconds(Math.floor((Date.now() - origin) / 1000))
    const id = setInterval(
      () => setSessionSeconds(Math.floor((Date.now() - origin) / 1000)),
      1000,
    )
    return () => clearInterval(id)
  }, [session?.started_at])

  // Live rest elapsed — also drives RestTimerBanner display via startedAt prop
  const liveRestElapsed = useCountUp(restStartedAt)
  const totalRest = totalRestSeconds + liveRestElapsed
  const workingTime = Math.max(0, sessionSeconds - totalRest)

  // Redirect to summary if session is already finished
  useEffect(() => {
    if (session?.finished_at) {
      router.replace(`/logs/${sessionId}/summary`)
    }
  }, [session?.finished_at, sessionId, router])

  if (isLoading) return <SessionSkeleton />

  if (!session || error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <Dumbbell className="size-12 text-muted-foreground/40" aria-hidden />
        <p className="text-base font-semibold text-foreground">{t.logs.sessionNotFound}</p>
        <p className="text-sm text-muted-foreground">
          {t.logs.sessionNotFoundDesc}
        </p>
        <Button variant="outline" onClick={() => router.push('/logs')}>
          <ArrowLeft className="size-4" aria-hidden />
          {t.logs.backToLogs}
        </Button>
      </div>
    )
  }

  const volume = computeVolume(session)

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to logs"
            onClick={() => router.push('/logs')}
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-foreground">
              {sessionLabel(session)}
            </h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {/* Tag chip — opens tag picker */}
              <button
                type="button"
                onClick={() => setTagPickerOpen(true)}
                aria-label={session.day_tag
                  ? (t.logs.dayTags as Record<string, string>)[session.day_tag] ?? session.day_tag
                  : t.logs.addTag}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  session.day_tag
                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {session.day_tag
                  ? (t.logs.dayTags as Record<string, string>)[session.day_tag] ?? session.day_tag
                  : t.logs.addTag}
              </button>

              {/* Program link chip — opens program picker */}
              <button
                type="button"
                onClick={() => setLinkProgramOpen(true)}
                aria-label={linkedDay ? linkedDay.name : t.logs.linkProgram}
                className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  session.program_day_id
                    ? 'bg-secondary text-foreground hover:bg-secondary/70'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <ClipboardList className="size-3 shrink-0" aria-hidden />
                {linkedDay ? linkedDay.name : t.logs.linkProgram}
              </button>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!isTrainerSession && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBattleOpen(true)}
              aria-label={t.battle.modalTitle}
              className={battle ? 'text-primary' : 'text-muted-foreground hover:text-primary'}
            >
              <Swords className="mr-1 size-4" aria-hidden />
              {t.battle.battleBtn}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDiscardOpen(true)}
            aria-label={t.logs.discardSession}
            className="text-muted-foreground hover:text-destructive"
          >
            {t.logs.discardSession}
          </Button>
          <Button
            size="sm"
            onClick={() => setFinishOpen(true)}
            aria-label={t.logs.finishSession}
          >
            {t.logs.finishSession}
          </Button>
        </div>
      </header>

      {/* ── Metrics strip — elapsed / working / resting / volume ────────────── */}
      <div className="flex shrink-0 items-center gap-5 overflow-x-auto border-b border-border bg-background/60 px-6 py-2 text-xs text-muted-foreground [scrollbar-width:none]">
        <div className="shrink-0 text-center">
          <p className="font-semibold tabular-nums text-foreground">{formatCountUp(sessionSeconds)}</p>
          <p className="text-[10px] uppercase tracking-wide">{t.logs.elapsed}</p>
        </div>
        <div className="shrink-0 text-center">
          <p className="font-semibold tabular-nums text-foreground">{formatCountUp(workingTime)}</p>
          <p className="text-[10px] uppercase tracking-wide">{t.logs.working}</p>
        </div>
        <div className="shrink-0 text-center">
          <p className="font-semibold tabular-nums text-foreground">{formatCountUp(totalRest)}</p>
          <p className="text-[10px] uppercase tracking-wide">{t.logs.resting}</p>
        </div>
        {totalLoggedWorkSeconds > 0 && (
          <div className="shrink-0 text-center">
            <p className="font-semibold tabular-nums text-foreground">{formatCountUp(totalLoggedWorkSeconds)}</p>
            <p className="text-[10px] uppercase tracking-wide">{t.logs.loggedSets}</p>
          </div>
        )}
        <div className="shrink-0 text-center">
          <p className="font-semibold tabular-nums text-foreground">{formatVolume(volume)}</p>
          <p className="text-[10px] uppercase tracking-wide">{t.logs.totalVolume}</p>
        </div>
        {/* Rest timer trigger — lives here so its purpose (session-level timing) is clear */}
        <button
          type="button"
          onClick={() => setRestStartedAt(new Date())}
          aria-label={t.logs.startRest}
          className={cn(
            'ml-auto shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            restStartedAt
              ? 'bg-primary/10 text-primary'
              : 'bg-secondary text-foreground hover:bg-secondary/70',
          )}
        >
          <Timer className="size-3.5 shrink-0" aria-hidden />
          {t.logs.startRest}
        </button>
      </div>

      {/* ── Rest timer banner ────────────────────────────────────────────────── */}
      {restStartedAt && (
        <div className="shrink-0 px-4 pt-3 sm:px-6">
          <RestTimerBanner
            startedAt={restStartedAt}
            onStop={(elapsed) => {
              setTotalRestSeconds((prev) => prev + elapsed)
              setRestStartedAt(null)
            }}
          />
        </div>
      )}

      {/* ── Battle strip ────────────────────────────────────────────────────── */}
      {battle && (
        <BattleStrip battle={battle} currentUserId={currentUser?.id} />
      )}

      {/* ── Exercise list ─────────────────────────────────────────────────────── */}
      <main className="flex-1 space-y-3 overflow-y-auto p-4 pb-36 sm:p-6 lg:pb-24">
        {session.logged_exercises.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Dumbbell className="size-10 text-muted-foreground/40" aria-hidden />
            <p className="font-semibold text-foreground">{t.logs.noExercisesYet}</p>
            <p className="text-sm text-muted-foreground">
              {t.logs.noExercisesYetDesc}
            </p>
          </div>
        ) : (
          session.logged_exercises.map((ex) => (
            <ExerciseBlock
              key={ex.id}
              exercise={ex}
              sessionId={sessionId}
              onStartRest={() => setRestStartedAt(new Date())}
              onLogSet={(dur) => {
                if (dur > 0) setTotalLoggedWorkSeconds((prev) => prev + dur)
              }}
              demoVideoUrl={ex.demo_video_url}
            />
          ))
        )}
      </main>

      {/* ── Floating add-exercise button ──────────────────────────────────────── */}
      <div className="fixed bottom-20 left-0 right-0 z-30 flex justify-center px-4 lg:bottom-6 lg:left-64">
        <Button
          size="lg"
          className="h-12 gap-2.5 rounded-full px-10 text-base font-semibold shadow-[0_4px_0_rgba(109,40,217,1),0_8px_24px_rgba(124,58,237,0.40)] transition-all duration-100 active:translate-y-[3px] active:shadow-[0_1px_0_rgba(109,40,217,1),0_2px_8px_rgba(124,58,237,0.25)]"
          onClick={() => setDrawerOpen(true)}
          aria-label={t.logs.addExercise}
        >
          <Plus className="size-5" aria-hidden />
          {t.logs.addExercise}
        </Button>
      </div>

      {/* ── Add exercise drawer ───────────────────────────────────────────────── */}
      <AddExerciseDrawer
        sessionId={sessionId}
        dayTag={session.day_tag}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {/* ── Finish dialog ──────────────────────────────────────────────────────── */}
      <FinishDialog
        sessionId={sessionId}
        athleteId={isTrainerSession ? session.athlete_id : undefined}
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
      />

      {/* ── Discard dialog ─────────────────────────────────────────────────────── */}
      <DiscardDialog
        sessionId={sessionId}
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
      />

      {/* ── Tag picker drawer ──────────────────────────────────────────────────── */}
      <TagPickerDrawer
        sessionId={sessionId}
        currentTag={session.day_tag}
        open={tagPickerOpen}
        onClose={() => setTagPickerOpen(false)}
      />

      {/* ── Link program drawer ────────────────────────────────────────────────── */}
      <LinkProgramDrawer
        sessionId={sessionId}
        currentProgramDayId={session.program_day_id}
        open={linkProgramOpen}
        onClose={() => setLinkProgramOpen(false)}
      />

      {/* ── Battle modal ───────────────────────────────────────────────────────── */}
      {battleOpen && (
        <BattleInitiateModal
          open={battleOpen}
          onClose={() => setBattleOpen(false)}
          sessionId={sessionId}
          existingBattle={battle ?? null}
        />
      )}
    </div>
  )
}
