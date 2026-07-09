'use client'

import { useState, useEffect, useRef } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useSession } from '@/hooks/logs/use-session'
import { useFinishSession } from '@/hooks/logs/use-finish-session'
import { useAddExercise, useDeleteExercise } from '@/hooks/logs/use-exercise-log'
import { useAddSet, useDeleteSet } from '@/hooks/logs/use-log-set'
import { useExerciseSearch } from '@/hooks/training/use-exercises'
import { useExerciseLastSession } from '@/hooks/logs/use-exercise-history'
import type { WorkoutSession, LoggedExercise, LoggedSet, SetType, ExerciseLastSession } from '@/types/api'

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
      <span className="text-xs font-medium text-muted-foreground">Resting</span>
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
        Done
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
  const styles = SET_TYPE_STYLES[type] ?? 'bg-secondary text-muted-foreground'
  const label = type.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
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
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [setType, setSetType] = useState<SetType>('working')
  const [showRpe, setShowRpe] = useState(false)
  const [rpe, setRpe] = useState('')
  // Set timer
  const [setTimerStart, setSetTimerStart] = useState<Date | null>(null)
  const setTimerElapsed = useCountUp(setTimerStart)

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
          const logged = setTimerStart ? setTimerElapsed : 0
          setWeight('')
          setReps('')
          setRpe('')
          setSetTimerStart(null)
          onAfterLog?.(logged)
        },
      },
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 rounded-lg border border-border bg-background/60 p-3"
      aria-label="Log a set"
    >
      {/* Set type chips */}
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {SET_TYPE_CHIPS.map((t) => {
          const label = t.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
          return (
            <button
              key={t}
              type="button"
              onClick={() => setSetType(t)}
              aria-pressed={setType === t}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                setType === t
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
          {showRpe ? 'Hide RPE' : 'RPE?'}
        </button>
      </div>

      {/* Footer: set timer + submit */}
      <div className="mt-3 flex items-center justify-between gap-2">
        {/* Set timer — tap to start/stop, informational only */}
        <button
          type="button"
          aria-label={setTimerStart ? 'Stop set timer' : 'Start set timer'}
          onClick={() =>
            setSetTimerStart((prev) => (prev ? null : new Date()))
          }
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium tabular-nums transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            setTimerStart
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
          )}
        >
          <Timer className="size-3.5 shrink-0" aria-hidden />
          {setTimerStart ? formatCountUp(setTimerElapsed) : 'Set timer'}
        </button>

        <Button
          type="submit"
          size="sm"
          disabled={!isValid || addSet.isPending}
          aria-label="Log this set"
        >
          {addSet.isPending ? (
            <>
              <Loader2 className="size-3 animate-spin" aria-hidden />
              Logging…
            </>
          ) : (
            'Log set'
          )}
        </Button>
      </div>
    </form>
  )
}

// ── PreviousSessionPanel ──────────────────────────────────────────────────────

interface PreviousSessionPanelProps {
  data: ExerciseLastSession
  showAverage: boolean
  onToggleAverage: () => void
}

function PreviousSessionPanel({ data, showAverage, onToggleAverage }: PreviousSessionPanelProps) {
  const dateStr = new Date(data.session_date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  const avg = data.average

  return (
    <div className="mb-3 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Last · {data.session_name} · {dateStr}
        </span>
        <button
          type="button"
          onClick={onToggleAverage}
          aria-label={showAverage ? 'Hide averages' : 'Show averages'}
          className={cn(
            'rounded p-0.5 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            showAverage
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
          )}
        >
          <MoreHorizontal className="size-3.5" aria-hidden />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {data.sets.map((set, i) => (
          <div key={set.id} className="flex items-center gap-2 text-xs">
            <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground">
              #{i + 1}
            </span>
            <SetTypeBadge type={set.set_type} />
            <span className="font-medium tabular-nums text-foreground">
              {set.weight_kg} kg × {set.reps}
            </span>
            {set.rpe != null && (
              <span className="text-[11px] text-muted-foreground">@ RPE {set.rpe}</span>
            )}
          </div>
        ))}
      </div>

      {showAverage && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border/50 pt-2">
          {avg.weight_kg != null && (
            <div className="text-center">
              <p className="text-xs font-semibold tabular-nums">{avg.weight_kg.toFixed(1)} kg</p>
              <p className="text-[10px] text-muted-foreground">avg weight</p>
            </div>
          )}
          {avg.reps != null && (
            <div className="text-center">
              <p className="text-xs font-semibold tabular-nums">{avg.reps.toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground">avg reps</p>
            </div>
          )}
          {avg.rpe != null && (
            <div className="text-center">
              <p className="text-xs font-semibold tabular-nums">{avg.rpe.toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground">avg RPE</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-xs font-semibold tabular-nums">
              {avg.total_volume_kg.toFixed(0)} kg
            </p>
            <p className="text-[10px] text-muted-foreground">total vol.</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold tabular-nums">{avg.sets_count}</p>
            <p className="text-[10px] text-muted-foreground">sets</p>
          </div>
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
}

function ExerciseBlock({ exercise, sessionId, onStartRest, onLogSet }: ExerciseBlockProps) {
  const [showAddSet, setShowAddSet] = useState(false)
  const [showAverage, setShowAverage] = useState(false)
  const deleteExercise = useDeleteExercise(sessionId)
  const { data: lastSession } = useExerciseLastSession(exercise.exercise_id)

  const name = exercise.exercise_name_free ?? `Exercise #${exercise.position + 1}`

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{name}</h3>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Start rest timer"
            onClick={onStartRest}
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors',
              'hover:bg-secondary hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <Timer className="size-3.5 shrink-0" aria-hidden />
            Rest
          </button>
          <button
            type="button"
            aria-label={`Remove ${name}`}
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

      {/* Previous session data — only for catalog exercises */}
      {lastSession && (
        <PreviousSessionPanel
          data={lastSession}
          showAverage={showAverage}
          onToggleAverage={() => setShowAverage((v) => !v)}
        />
      )}

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
            Done adding sets
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddSet(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary transition-opacity hover:opacity-70"
        >
          <Plus className="size-3" aria-hidden />
          Add set
        </button>
      )}
    </div>
  )
}

// ── SetRow ────────────────────────────────────────────────────────────────────

interface SetRowProps {
  set: LoggedSet
  sessionId: string
  exerciseId: string
}

function SetRow({ set, sessionId, exerciseId }: SetRowProps) {
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
        aria-label="Remove this set"
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
  legs:      ['quads', 'hamstrings', 'glutes', 'calves'],
  upper:     ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  lower:     ['quads', 'hamstrings', 'glutes', 'calves'],
  full_body: ['full_body', 'chest', 'back', 'quads'],
  cardio:    ['core', 'full_body'],
}

const MUSCLE_LABEL: Record<string, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders',
  biceps: 'Biceps', triceps: 'Triceps', core: 'Core',
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes',
  calves: 'Calves', full_body: 'Full Body', forearms: 'Forearms',
}

const EQUIPMENT_LABEL: Record<string, string> = {
  barbell: 'Barbell', dumbbell: 'Dumbbell', machine: 'Machine',
  cable: 'Cable', bodyweight: 'Bodyweight', kettlebell: 'Kettlebell',
  bands: 'Bands', other: 'Other',
}

interface AddExerciseDrawerProps {
  sessionId: string
  dayTag: string | null
  open: boolean
  onClose: () => void
}

function AddExerciseDrawer({ sessionId, dayTag, open, onClose }: AddExerciseDrawerProps) {
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
          <h2 className="text-base font-semibold text-foreground">Add exercise</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
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
              placeholder="Search exercise catalog…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 pr-9"
              aria-label="Search exercises"
            />
          </div>
        </div>

        {/* Muscle-group pills */}
        {!isSearching && groups.length > 0 && (
          <div
            className="flex shrink-0 gap-2 overflow-x-auto px-5 pb-3"
            role="group"
            aria-label="Filter by muscle group"
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
                {MUSCLE_LABEL[g] ?? g}
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
                  <li key={ex.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      disabled={!!addingId || addingCustom}
                      onClick={() => {
                        // Include equipment so "Bench Press (Barbell)" and
                        // "Bench Press (Dumbbell)" are distinct on the workout card.
                        const label = `${ex.name} (${EQUIPMENT_LABEL[ex.equipment] ?? ex.equipment})`
                        addFromCatalog(ex.id, label)
                      }}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
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
                          : EQUIPMENT_LABEL[ex.equipment]?.slice(0, 2) ?? '??'
                        }
                      </div>

                      {/* Name + muscle group */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{ex.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {EQUIPMENT_LABEL[ex.equipment] ?? ex.equipment}
                          <span className="mx-1.5 text-border">·</span>
                          {MUSCLE_LABEL[ex.muscle_group] ?? ex.muscle_group}
                        </p>
                      </div>

                      {/* Chevron */}
                      {!isAdding && (
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" aria-hidden />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : isSearching ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              No results for &ldquo;{query.trim()}&rdquo; — try the custom field below.
            </p>
          ) : groups.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Search above or add a custom exercise below.
            </p>
          ) : null}
        </div>

        {/* ── Custom exercise ── always visible ─────────────────────────────── */}
        <div className="shrink-0 border-t border-border bg-background px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Custom exercise
          </p>
          <div className="flex gap-2">
            <Input
              ref={customRef}
              type="text"
              placeholder="e.g. Smith machine squat, cable fly…"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addCustom() }}
              disabled={addingCustom || !!addingId}
              aria-label="Custom exercise name"
              className="flex-1"
            />
            <Button
              size="icon"
              disabled={!customName.trim() || addingCustom || !!addingId}
              onClick={addCustom}
              aria-label="Add custom exercise"
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

// ── FinishDialog ──────────────────────────────────────────────────────────────

interface FinishDialogProps {
  sessionId: string
  open: boolean
  onClose: () => void
}

function FinishDialog({ sessionId, open, onClose }: FinishDialogProps) {
  const router = useRouter()
  const [difficulty, setDifficulty] = useState<number | ''>('')
  const [notes, setNotes] = useState('')

  const finish = useFinishSession(sessionId)

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
        className="fixed inset-x-4 bottom-4 z-50 rounded-2xl border border-border bg-background p-5 shadow-xl sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-sm sm:-translate-x-1/2"
      >
        <h2 className="text-base font-semibold text-foreground">Finish workout?</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          How did it go? These fields are optional.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          {/* Perceived difficulty */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="difficulty"
              className="flex items-center gap-1 text-xs font-semibold text-foreground"
            >
              Perceived difficulty
              <span className="font-normal text-muted-foreground">(1 = easy, 10 = max)</span>
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
              Session notes
            </label>
            <textarea
              id="finish-notes"
              placeholder="e.g. Great session, PR on bench press"
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
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={finish.isPending}
            onClick={handleFinish}
          >
            {finish.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              'Finish Workout'
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
  params: { sessionId: string }
}) {
  const router = useRouter()
  const { sessionId } = params

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [restStartedAt, setRestStartedAt] = useState<Date | null>(null)
  const [totalRestSeconds, setTotalRestSeconds] = useState(0)
  const [totalLoggedWorkSeconds, setTotalLoggedWorkSeconds] = useState(0)

  const { data: session, isLoading, error } = useSession(sessionId)

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
        <p className="text-base font-semibold text-foreground">Session not found</p>
        <p className="text-sm text-muted-foreground">
          This workout session doesn&apos;t exist or has been removed.
        </p>
        <Button variant="outline" onClick={() => router.push('/logs')}>
          <ArrowLeft className="size-4" aria-hidden />
          Back to logs
        </Button>
      </div>
    )
  }

  const volume = computeVolume(session)

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to logs"
            onClick={() => router.push('/logs')}
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Button>
          <h1 className="text-sm font-semibold text-foreground">
            {sessionLabel(session)}
          </h1>
        </div>
        <Button
          size="sm"
          onClick={() => setFinishOpen(true)}
          aria-label="Finish this workout"
        >
          Finish
        </Button>
      </header>

      {/* ── Metrics strip — elapsed / working / resting / volume ────────────── */}
      <div className="flex shrink-0 gap-5 overflow-x-auto border-b border-border bg-background/60 px-6 py-2 text-xs text-muted-foreground [scrollbar-width:none]">
        <div className="shrink-0 text-center">
          <p className="font-semibold tabular-nums text-foreground">{formatCountUp(sessionSeconds)}</p>
          <p className="text-[10px] uppercase tracking-wide">Elapsed</p>
        </div>
        <div className="shrink-0 text-center">
          <p className="font-semibold tabular-nums text-foreground">{formatCountUp(workingTime)}</p>
          <p className="text-[10px] uppercase tracking-wide">Working</p>
        </div>
        <div className="shrink-0 text-center">
          <p className="font-semibold tabular-nums text-foreground">{formatCountUp(totalRest)}</p>
          <p className="text-[10px] uppercase tracking-wide">Resting</p>
        </div>
        {totalLoggedWorkSeconds > 0 && (
          <div className="shrink-0 text-center">
            <p className="font-semibold tabular-nums text-foreground">{formatCountUp(totalLoggedWorkSeconds)}</p>
            <p className="text-[10px] uppercase tracking-wide">Logged sets</p>
          </div>
        )}
        <div className="shrink-0 text-center">
          <p className="font-semibold tabular-nums text-foreground">{formatVolume(volume)}</p>
          <p className="text-[10px] uppercase tracking-wide">Volume</p>
        </div>
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

      {/* ── Exercise list ─────────────────────────────────────────────────────── */}
      <main className="flex-1 space-y-3 overflow-y-auto p-4 pb-28 sm:p-6">
        {session.logged_exercises.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Dumbbell className="size-10 text-muted-foreground/40" aria-hidden />
            <p className="font-semibold text-foreground">No exercises yet</p>
            <p className="text-sm text-muted-foreground">
              Tap &ldquo;Add Exercise&rdquo; below to start logging sets.
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
            />
          ))
        )}
      </main>

      {/* ── Sticky bottom bar — Add exercise ──────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/90 px-4 py-3 backdrop-blur sm:px-6">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setDrawerOpen(true)}
          aria-label="Add a new exercise to this session"
        >
          <Plus className="size-4" aria-hidden />
          Add Exercise
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
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
      />
    </div>
  )
}
