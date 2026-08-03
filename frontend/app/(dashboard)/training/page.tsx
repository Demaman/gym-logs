'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  ChevronRight,
  ChevronDown,
  Dumbbell,
  Play,
  Loader2,
  ClipboardList,
  Trash2,
  X,
  MoreHorizontal,
  User,
  ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useRole } from '@/hooks/use-role'
import { useAuthStore } from '@/lib/auth/store'
import { useI18n } from '@/providers/i18n-provider'
import { useQueryClient } from '@tanstack/react-query'
import { usePrograms, useCreateProgram, useDeleteProgram, useAddDay, useDeleteDay, useDeleteProgramExercise } from '@/hooks/training/use-programs'
import { addExerciseToDay, addPrescribedSet, replacePrescribedSets } from '@/lib/api/training'
import { useStartSession } from '@/hooks/logs/use-start-session'
import { useActiveSession } from '@/hooks/logs/use-active-session'
import { deleteSession } from '@/lib/api/logs'
import { useExerciseSearch } from '@/hooks/training/use-exercises'
import type { Program, ProgramDay, ProgramExercise, PrescribedSet, DayTag, Exercise } from '@/types/api'

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_TAGS: DayTag[] = [
  'push', 'pull', 'legs', 'upper', 'lower', 'full_body',
  'chest', 'back', 'shoulders', 'arms', 'glutes', 'core', 'cardio', 'custom',
]

const DAY_TAG_LABELS: Record<DayTag, string> = {
  push: 'Push', pull: 'Pull', legs: 'Legs', upper: 'Upper', lower: 'Lower',
  full_body: 'Full Body', chest: 'Chest', back: 'Back', shoulders: 'Shoulders',
  arms: 'Arms', glutes: 'Glutes', core: 'Core', cardio: 'Cardio', custom: 'Custom',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSetsLabel(sets: PrescribedSet[]): string {
  if (sets.length === 0) return 'No sets prescribed'
  const first = sets[0]
  const count = sets.length
  const reps = first.rep_min === first.rep_max
    ? `${first.rep_min} reps`
    : `${first.rep_min}–${first.rep_max} reps`
  const rpe = first.rpe_target ? ` @ RPE ${first.rpe_target}` : ''
  return `${count} × ${reps}${rpe}`
}

function totalExercises(program: Program): number {
  return program.days.reduce((sum, d) => sum + d.exercises.length, 0)
}

// ── Prescribed sets chip ──────────────────────────────────────────────────────

function SetsChip({ sets }: { sets: PrescribedSet[] }) {
  if (sets.length === 0) {
    return (
      <span className="text-[11px] text-muted-foreground">No sets prescribed</span>
    )
  }
  const label = formatSetsLabel(sets)
  return (
    <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      {label}
    </span>
  )
}

// ── Exercise row inside a day block ───────────────────────────────────────────

interface SetDraft {
  rep_min: number
  rep_max: number
  rpe: string
}

interface ExerciseRowProps {
  ex: ProgramExercise
  exerciseMap: Map<string, Exercise>
  canEdit: boolean
  onDelete: (exId: string) => void
}

function ExerciseRow({ ex, exerciseMap, canEdit, onDelete }: ExerciseRowProps) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const exercise = exerciseMap.get(ex.exercise_id)
  const name = exercise?.name ?? 'Unknown exercise'
  const [editing, setEditing] = useState(false)
  const [drafts, setDrafts] = useState<SetDraft[]>([])
  const [isSaving, setIsSaving] = useState(false)

  function openEdit() {
    const base = ex.prescribed_sets.length > 0
      ? ex.prescribed_sets.map((s) => ({
          rep_min: s.rep_min,
          rep_max: s.rep_max,
          rpe: s.rpe_target != null ? String(s.rpe_target) : '',
        }))
      : [{ rep_min: 8, rep_max: 12, rpe: '' }]
    setDrafts(base)
    setEditing(true)
  }

  function addDraftSet() {
    const last = drafts[drafts.length - 1]
    setDrafts((d) => [...d, { rep_min: last?.rep_min ?? 8, rep_max: last?.rep_max ?? 12, rpe: last?.rpe ?? '' }])
  }

  function updateDraft(i: number, field: keyof SetDraft, value: string | number) {
    setDrafts((d) => d.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  function clampReps(i: number, field: 'rep_min' | 'rep_max', raw: number) {
    setDrafts((d) => d.map((s, idx) => {
      if (idx !== i) return s
      if (field === 'rep_min') return { ...s, rep_min: Math.min(raw, s.rep_max) }
      return { ...s, rep_max: Math.max(raw, s.rep_min) }
    }))
  }

  async function save() {
    setIsSaving(true)
    try {
      await replacePrescribedSets(
        ex.id,
        drafts.map((d, i) => ({
          position: i + 1,
          set_type: 'working' as const,
          rep_min: d.rep_min,
          rep_max: d.rep_max,
          rpe_target: d.rpe !== '' ? parseFloat(d.rpe) : null,
        })),
      )
      await qc.invalidateQueries({ queryKey: ['training', 'programs'] })
      setEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded-lg">
      {/* Collapsed row — whole row is the click target */}
      <div
        className={cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent/30',
          canEdit && 'cursor-pointer',
        )}
        onClick={canEdit ? (editing ? () => setEditing(false) : openEdit) : undefined}
        role={canEdit ? 'button' : undefined}
        tabIndex={canEdit ? 0 : undefined}
        onKeyDown={canEdit ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            editing ? setEditing(false) : openEdit()
          }
        } : undefined}
        aria-expanded={canEdit ? editing : undefined}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <Dumbbell className="size-3.5 text-primary" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <SetsChip sets={ex.prescribed_sets} />
        </div>
        {canEdit && (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <ChevronDown
              className={cn('size-3.5 text-muted-foreground transition-transform duration-150', editing && 'rotate-180')}
              aria-hidden
            />
            <button
              type="button"
              aria-label={`Remove ${name}`}
              onClick={(e) => { e.stopPropagation(); onDelete(ex.id) }}
              className="rounded-full bg-destructive/10 p-1 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Inline edit panel */}
      {editing && (
        <div className="mx-2 mb-2 rounded-lg border border-border bg-background p-3">
          <div className="mb-2 flex flex-col gap-1.5">
            {drafts.map((draft, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-5 shrink-0 text-center text-[11px] font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                <input
                  type="number"
                  min={1}
                  max={draft.rep_max}
                  value={draft.rep_min}
                  onChange={(e) => updateDraft(i, 'rep_min', Number(e.target.value))}
                  onBlur={(e) => clampReps(i, 'rep_min', Number(e.target.value))}
                  className="h-7 w-12 rounded border border-input bg-card px-1.5 text-center text-xs tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label="Min reps"
                />
                <span className="text-[11px] text-muted-foreground">–</span>
                <input
                  type="number"
                  min={draft.rep_min}
                  max={50}
                  value={draft.rep_max}
                  onChange={(e) => updateDraft(i, 'rep_max', Number(e.target.value))}
                  onBlur={(e) => clampReps(i, 'rep_max', Number(e.target.value))}
                  className="h-7 w-12 rounded border border-input bg-card px-1.5 text-center text-xs tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label="Max reps"
                />
                <span className="ml-2 text-[11px] text-muted-foreground">RPE</span>
                <input
                  type="number"
                  min={5}
                  max={10}
                  step={0.5}
                  placeholder="–"
                  value={draft.rpe}
                  onChange={(e) => updateDraft(i, 'rpe', e.target.value)}
                  className="h-7 w-14 rounded border border-input bg-card px-1.5 text-center text-xs tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label="RPE target"
                />
                <button
                  type="button"
                  aria-label="Remove set"
                  onClick={() => setDrafts((d) => d.filter((_, idx) => idx !== i))}
                  className="ml-auto rounded p-0.5 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addDraftSet}
            className="mb-3 flex items-center gap-1 text-[11px] font-medium text-primary hover:opacity-70"
          >
            <Plus className="size-3" aria-hidden />
            {t.training.addSet}
          </button>

          <div className="flex gap-2">
            <Button size="sm" className="flex-1" disabled={isSaving || drafts.length === 0} onClick={save}>
              {isSaving && <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />}
              {t.training.saveSets}
            </Button>
            <Button size="sm" variant="outline" disabled={isSaving} onClick={() => setEditing(false)}>
              {t.common.cancel}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Add exercise to day (two-step: search → configure sets) ──────────────────

interface AddExercisePanelProps {
  dayId: string
  dayExerciseCount: number
  exercises: Exercise[]
  onClose: () => void
}

function AddExercisePanel({ dayId, dayExerciseCount, exercises, onClose }: AddExercisePanelProps) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [query, setQuery] = useState('')
  const [selectedEx, setSelectedEx] = useState<Exercise | null>(null)
  const [setsCount, setSetsCount] = useState(3)
  const [repMin, setRepMin] = useState(8)
  const [repMax, setRepMax] = useState(12)
  const [rpe, setRpe] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const filtered = exercises.filter((e) =>
    e.name.toLowerCase().includes(query.toLowerCase()),
  )

  async function submit(withSets: boolean) {
    if (!selectedEx) return
    setIsSubmitting(true)
    try {
      const programEx = await addExerciseToDay(dayId, {
        exercise_id: selectedEx.id,
        position: dayExerciseCount + 1,
      })
      if (withSets) {
        const rpeVal = rpe !== '' ? parseFloat(rpe) : null
        for (let i = 0; i < setsCount; i++) {
          await addPrescribedSet(programEx.id, {
            position: i + 1,
            set_type: 'working',
            rep_min: repMin,
            rep_max: repMax,
            rpe_target: rpeVal,
          })
        }
      }
      await qc.invalidateQueries({ queryKey: ['training', 'programs'] })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Step 1: pick exercise ──────────────────────────────────────────────────
  if (!selectedEx) {
    return (
      <div className="mt-2 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="relative mb-2">
          <Input
            ref={inputRef}
            placeholder={t.logs.searchExercises}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-40 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">{t.logs.noExercises}</p>
          ) : (
            filtered.slice(0, 20).map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => setSelectedEx(ex)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent/50"
              >
                <Dumbbell className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate text-foreground">{ex.name}</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{ex.muscle_group}</span>
              </button>
            ))
          )}
        </div>
        <div className="mt-2 flex justify-end">
          <button type="button" onClick={onClose} className="text-xs font-medium text-muted-foreground hover:text-foreground">
            {t.training.cancelAdd}
          </button>
        </div>
      </div>
    )
  }

  // ── Step 2: configure sets ─────────────────────────────────────────────────
  return (
    <div className="mt-2 rounded-xl border border-border bg-card p-4 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedEx(null)}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label={t.training.backToSearch}
        >
          <ArrowLeft className="size-3.5" aria-hidden />
        </button>
        <p className="truncate text-sm font-semibold text-foreground">{selectedEx.name}</p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Sets count */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t.training.sets}</p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSetsCount(n)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition-colors',
                  setsCount === n
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:bg-accent',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Rep range */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t.training.reps}</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={repMax}
              value={repMin}
              onChange={(e) => setRepMin(Math.min(Number(e.target.value), repMax))}
              className="h-8 w-16 rounded-lg border border-input bg-background px-2 text-center text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <input
              type="number"
              min={repMin}
              max={50}
              value={repMax}
              onChange={(e) => setRepMax(Math.max(Number(e.target.value), repMin))}
              className="h-8 w-16 rounded-lg border border-input bg-background px-2 text-center text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        {/* RPE (optional) */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t.training.rpeOptional}</p>
          <input
            type="number"
            min={5}
            max={10}
            step={0.5}
            placeholder="e.g. 7.5"
            value={rpe}
            onChange={(e) => setRpe(e.target.value)}
            className="h-8 w-24 rounded-lg border border-input bg-background px-2 text-center text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1"
            disabled={isSubmitting}
            onClick={() => submit(true)}
          >
            {isSubmitting && <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />}
            {t.training.addWithSets}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => submit(false)}
          >
            {t.training.skipSets}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Day block (expandable) ────────────────────────────────────────────────────

interface DayBlockProps {
  day: ProgramDay
  exerciseMap: Map<string, Exercise>
  allExercises: Exercise[]
  canEdit: boolean
  isStarting: boolean
  onStartSession: (day: ProgramDay) => void
  onDeleteDay: (dayId: string) => void
  onDeleteExercise: (exId: string) => void
}

function DayBlock({
  day, exerciseMap, allExercises, canEdit, isStarting,
  onStartSession, onDeleteDay, onDeleteExercise,
}: DayBlockProps) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [showDayMenu, setShowDayMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const sortedExercises = [...day.exercises].sort((a, b) => a.position - b.position)

  return (
    <div className="group rounded-xl border border-border bg-card">
      {/* Day header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={expanded}
        >
          {expanded
            ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            : <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          }
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{day.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {DAY_TAG_LABELS[day.day_tag]} · {day.exercises.length} exercise{day.exercises.length !== 1 ? 's' : ''}
            </p>
          </div>
        </button>

        {/* Start session button */}
        <Button
          size="sm"
          variant="outline"
          disabled={isStarting}
          onClick={() => onStartSession(day)}
          className="shrink-0 gap-1.5"
        >
          {isStarting
            ? <Loader2 className="size-3.5 animate-spin" aria-hidden />
            : <Play className="size-3.5" aria-hidden />
          }
          {t.training.startSession}
        </Button>

        {/* Day menu (edit/delete) */}
        {canEdit && (
          <div className="relative shrink-0">
            <button
              type="button"
              aria-label="Day options"
              onClick={() => setShowDayMenu((v) => !v)}
              className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </button>
            {showDayMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDayMenu(false)}
                />
                <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-border bg-card py-1 shadow-lg">
                  {!confirmDelete ? (
                    <button
                      type="button"
                      onClick={() => { setConfirmDelete(true); setShowDayMenu(false) }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent/50"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      {t.training.deleteDay}
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation inline */}
      {confirmDelete && (
        <div className="mx-4 mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm font-medium text-foreground">{t.training.deleteConfirmTitle} &ldquo;{day.name}&rdquo;?</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t.training.deleteConfirmDay}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmDelete(false)}
            >
              {t.training.cancel}
            </Button>
            <Button
              size="sm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { onDeleteDay(day.id); setConfirmDelete(false) }}
            >
              {t.training.deleteConfirmTitle}
            </Button>
          </div>
        </div>
      )}

      {/* Expanded exercises */}
      {expanded && (
        <div className="border-t border-border px-2 pb-3 pt-2">
          {sortedExercises.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              No exercises yet. Add one below.
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {sortedExercises.map((ex) => (
                <ExerciseRow
                  key={ex.id}
                  ex={ex}
                  exerciseMap={exerciseMap}
                  canEdit={canEdit}
                  onDelete={onDeleteExercise}
                />
              ))}
            </div>
          )}

          {canEdit && (
            <>
              {showAddExercise ? (
                <AddExercisePanel
                  dayId={day.id}
                  dayExerciseCount={day.exercises.length}
                  exercises={allExercises}
                  onClose={() => setShowAddExercise(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddExercise(true)}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary hover:bg-accent/30"
                >
                  <Plus className="size-3.5" aria-hidden />
                  {t.training.addExercise}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Program detail (right panel) ──────────────────────────────────────────────

interface ProgramDetailProps {
  program: Program
  exerciseMap: Map<string, Exercise>
  allExercises: Exercise[]
  canEdit: boolean
  currentUserId: string | undefined
  role: string
  onDeleteProgram: (id: string) => void
  onDeleteDay: (dayId: string) => void
  onDeleteExercise: (exId: string) => void
  onAddDay: () => void
  /** Mobile only: called when user taps "back to programs" */
  onBack?: () => void
}

function ProgramDetail({
  program, exerciseMap, allExercises, canEdit, currentUserId, role,
  onDeleteProgram, onDeleteDay, onDeleteExercise, onAddDay, onBack,
}: ProgramDetailProps) {
  const { t } = useI18n()
  const [startingDayId, setStartingDayId] = useState<string | null>(null)
  const [confirmDeleteProgram, setConfirmDeleteProgram] = useState(false)
  const [activeSessionConflict, setActiveSessionConflict] = useState(false)
  const [pendingDay, setPendingDay] = useState<ProgramDay | null>(null)
  const [isDiscarding, setIsDiscarding] = useState(false)
  const router = useRouter()
  const startSession = useStartSession()
  const queryClient = useQueryClient()
  const activeSession = useActiveSession()

  const sortedDays = [...program.days].sort((a, b) => a.position - b.position)

  const isAssignedToOther =
    program.athlete_id && program.athlete_id !== currentUserId

  async function handleStartSession(day: ProgramDay) {
    setStartingDayId(day.id)
    setActiveSessionConflict(false)
    try {
      const session = await startSession.mutateAsync({
        mode: 'program_driven',
        program_day_id: day.id,
        name: day.name,
        day_tag: day.day_tag,
      })
      router.push(`/logs/${session.id}`)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        setPendingDay(day)
        setActiveSessionConflict(true)
      }
    } finally {
      setStartingDayId(null)
    }
  }

  async function handleDiscardAndStart() {
    if (!pendingDay || !activeSession.data) return
    setIsDiscarding(true)
    try {
      await deleteSession(activeSession.data.id)
      await queryClient.invalidateQueries({ queryKey: ['logs', 'active'] })
      const session = await startSession.mutateAsync({
        mode: 'program_driven',
        program_day_id: pendingDay.id,
        name: pendingDay.name,
        day_tag: pendingDay.day_tag,
      })
      setActiveSessionConflict(false)
      setPendingDay(null)
      router.push(`/logs/${session.id}`)
    } finally {
      setIsDiscarding(false)
    }
  }

  function dismissConflict() {
    setActiveSessionConflict(false)
    setPendingDay(null)
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Mobile back button */}
      {onBack && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t.training.myPrograms}
          </button>
        </div>
      )}

      {activeSessionConflict && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={dismissConflict} aria-hidden />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-96 sm:-translate-x-1/2 sm:-translate-y-1/2"
            role="dialog"
            aria-modal
            aria-label="Active session"
          >
            <div className="rounded-t-2xl border-t border-border bg-card p-6 shadow-xl sm:rounded-2xl sm:border">
              <div className="mb-4 flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-foreground">{t.training.activeSessionTitle}</h3>
                <button
                  type="button"
                  onClick={dismissConflict}
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label={t.training.dismiss}
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <p className="mb-5 text-sm text-muted-foreground">
                {t.training.activeSessionBody}
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  className="w-full"
                  onClick={() => activeSession.data && router.push(`/logs/${activeSession.data.id}`)}
                  disabled={!activeSession.data}
                >
                  {t.training.continueSession}
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleDiscardAndStart}
                  disabled={isDiscarding || !pendingDay}
                >
                  {isDiscarding ? (
                    <><Loader2 className="mr-2 size-4 animate-spin" aria-hidden />{t.training.discarding}</>
                  ) : (
                    t.training.discardAndStart
                  )}
                </Button>
                <Button variant="ghost" className="w-full" onClick={dismissConflict}>
                  {t.training.dismiss}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* Program header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-foreground">{program.name}</h2>
            {program.description && (
              <p className="mt-1 text-sm text-muted-foreground">{program.description}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {sortedDays.length} day{sortedDays.length !== 1 ? 's' : ''} · {totalExercises(program)} exercise{totalExercises(program) !== 1 ? 's' : ''}
            </p>
          </div>
          {canEdit && (
            <div className="shrink-0">
              {!confirmDeleteProgram ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDeleteProgram(true)}
                  className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  {t.training.deleteProgram}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setConfirmDeleteProgram(false)}>
                    {t.training.cancel}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => onDeleteProgram(program.id)}
                  >
                    {t.training.confirmDelete}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Assigned-to banner (trainer/admin only) */}
        {isAssignedToOther && (role === 'trainer' || role === 'gym_admin') && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <User className="size-4 shrink-0 text-primary" aria-hidden />
            <p className="text-sm text-foreground">
              {t.training.assignedToAthlete}
            </p>
          </div>
        )}

        {/* Days */}
        {sortedDays.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ClipboardList className="size-10 text-muted" aria-hidden />
            <p className="font-semibold">{t.training.noTrainingDays}</p>
            <p className="text-sm text-muted-foreground">
              {t.training.noDays}
            </p>
            {canEdit && (
              <Button size="sm" onClick={onAddDay}>
                <Plus className="mr-1.5 size-4" aria-hidden />
                {t.training.addFirstDay}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedDays.map((day) => (
              <DayBlock
                key={day.id}
                day={day}
                exerciseMap={exerciseMap}
                allExercises={allExercises}
                canEdit={canEdit}
                isStarting={startingDayId === day.id}
                onStartSession={handleStartSession}
                onDeleteDay={onDeleteDay}
                onDeleteExercise={onDeleteExercise}
              />
            ))}
            {canEdit && (
              <button
                type="button"
                onClick={onAddDay}
                className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                <Plus className="size-4" aria-hidden />
                {t.training.addDay}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Program row (left panel) ──────────────────────────────────────────────────

interface ProgramRowProps {
  program: Program
  selected: boolean
  onSelect: () => void
}

function ProgramRow({ program, selected, onSelect }: ProgramRowProps) {
  const dayCount = program.days.length
  const exCount = totalExercises(program)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/50',
        selected && 'bg-accent',
      )}
    >
      {selected && (
        <span
          className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
          aria-hidden
        />
      )}
      <p className={cn('text-sm font-semibold', selected ? 'text-primary' : 'text-foreground')}>
        {program.name}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {dayCount} day{dayCount !== 1 ? 's' : ''} · {exCount} exercise{exCount !== 1 ? 's' : ''}
      </p>
    </button>
  )
}

// ── New Program sheet ─────────────────────────────────────────────────────────

interface NewProgramSheetProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string, description: string) => void
  isCreating: boolean
  error?: string | null
}

function NewProgramSheet({ open, onClose, onCreate, isCreating, error }: NewProgramSheetProps) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onCreate(name.trim(), description.trim())
  }

  useEffect(() => {
    if (!open) { setName(''); setDescription('') }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />

      {/* Dialog — full width bottom sheet on mobile, centered card on sm+ */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-96 sm:-translate-x-1/2 sm:-translate-y-1/2"
        role="dialog"
        aria-modal
        aria-label={t.training.newProgramTitle}
      >
        <div className="rounded-t-2xl border-t border-border bg-card p-6 shadow-xl sm:rounded-2xl sm:border">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">{t.training.newProgramTitle}</h3>
            <button
              type="button"
              aria-label={t.common.close}
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="prog-name" className="text-sm font-medium text-foreground">
                {t.training.programNameLabel} <span className="text-destructive" aria-hidden>*</span>
              </label>
              <Input
                id="prog-name"
                placeholder={t.training.programNamePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="prog-desc" className="text-sm font-medium text-foreground">
                {t.training.programDescLabel}
              </label>
              <Input
                id="prog-desc"
                placeholder={t.training.programDescPlaceholder}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={!name.trim() || isCreating}
              className="mt-1"
            >
              {isCreating && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
              {t.training.createProgram}
            </Button>
          </form>
        </div>
      </div>
    </>
  )
}

// ── Add Day sheet ─────────────────────────────────────────────────────────────

interface AddDaySheetProps {
  open: boolean
  onClose: () => void
  onAdd: (name: string, dayTag: DayTag, position: number) => void
  nextPosition: number
  isAdding: boolean
}

function AddDaySheet({ open, onClose, onAdd, nextPosition, isAdding }: AddDaySheetProps) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [dayTag, setDayTag] = useState<DayTag>('custom')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onAdd(name.trim(), dayTag, nextPosition)
  }

  useEffect(() => {
    if (!open) { setName(''); setDayTag('custom') }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />

      {/* Dialog */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-96 sm:-translate-x-1/2 sm:-translate-y-1/2"
        role="dialog"
        aria-modal
        aria-label={t.training.addDayTitle}
      >
        <div className="rounded-t-2xl border-t border-border bg-card p-6 shadow-xl sm:rounded-2xl sm:border">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">{t.training.addDayTitle}</h3>
            <button
              type="button"
              aria-label={t.common.close}
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="day-name" className="text-sm font-medium text-foreground">
                {t.training.dayNameLabel} <span className="text-destructive" aria-hidden>*</span>
              </label>
              <Input
                id="day-name"
                placeholder={t.training.dayNamePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="day-tag" className="text-sm font-medium text-foreground">
                {t.training.dayTypeLabel}
              </label>
              <select
                id="day-tag"
                value={dayTag}
                onChange={(e) => setDayTag(e.target.value as DayTag)}
                className="flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {DAY_TAGS.map((tag) => (
                  <option key={tag} value={tag}>{DAY_TAG_LABELS[tag]}</option>
                ))}
              </select>
            </div>
            <Button
              type="submit"
              disabled={!name.trim() || isAdding}
              className="mt-1"
            >
              {isAdding && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
              {t.training.addDay}
            </Button>
          </form>
        </div>
      </div>
    </>
  )
}

// ── Left panel skeleton ───────────────────────────────────────────────────────

function LeftPanelSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  )
}

// ── Right panel skeleton ──────────────────────────────────────────────────────

function RightPanelSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <Skeleton className="h-8 w-48 rounded-xl" />
      <Skeleton className="h-4 w-64 rounded-xl" />
      <div className="flex flex-col gap-3 pt-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ── Empty right panel ─────────────────────────────────────────────────────────

function EmptyRightPanel({ onNew }: { onNew: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <ClipboardList className="size-10 text-muted" aria-hidden />
      <p className="font-semibold text-foreground">{t.training.selectProgram}</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        {t.training.selectProgramDesc}
      </p>
      <Button size="sm" onClick={onNew}>
        <Plus className="mr-1.5 size-4" aria-hidden />
        {t.training.newProgram}
      </Button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TrainingPage() {
  const { t } = useI18n()
  const role = useRole()
  const currentUserId = useAuthStore((s) => s.user?.id)

  const { data: programs = [], isLoading: loadingPrograms } = usePrograms()
  const { data: allExercises = [], isLoading: loadingExercises } = useExerciseSearch(
    { limit: 100 },
    { enabled: true },
  )

  const exerciseMap = new Map(allExercises.map((e) => [e.id, e]))

  const createProgram = useCreateProgram()
  const deleteProgram = useDeleteProgram()
  const addDayMutation = useAddDay()
  const deleteDayMutation = useDeleteDay()
  const deleteExerciseMutation = useDeleteProgramExercise()

  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)
  const [showNewProgram, setShowNewProgram] = useState(false)
  const [showAddDay, setShowAddDay] = useState(false)
  const [createProgramError, setCreateProgramError] = useState<string | null>(null)
  // Mobile master-detail state
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')

  // Split programs by ownership
  const myPrograms = programs.filter(
    (p) => !p.athlete_id || p.athlete_id === currentUserId,
  )
  const forAthletes = programs.filter(
    (p) => !!p.athlete_id && p.athlete_id !== currentUserId,
  )

  const selectedProgram = programs.find((p) => p.id === selectedProgramId) ?? null

  // Auto-select first program when list loads (desktop only — on mobile stay on list view)
  useEffect(() => {
    if (!selectedProgramId && programs.length > 0) {
      setSelectedProgramId(programs[0].id)
    }
  }, [programs, selectedProgramId])

  const canEdit =
    role === 'trainer' || role === 'gym_admin' ||
    (role === 'athlete' && !!selectedProgram && selectedProgram.athlete_id === currentUserId)

  const nextDayPosition = selectedProgram ? selectedProgram.days.length + 1 : 1

  async function handleCreateProgram(name: string, description: string) {
    setCreateProgramError(null)
    try {
      const prog = await createProgram.mutateAsync({ name, description, mode: 'program_driven' })
      setSelectedProgramId(prog.id)
      setShowNewProgram(false)
      setMobileView('detail')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setCreateProgramError(detail ?? 'Failed to create program. Please try again.')
    }
  }

  async function handleAddDay(name: string, dayTag: DayTag, position: number) {
    if (!selectedProgramId) return
    await addDayMutation.mutateAsync({
      programId: selectedProgramId,
      payload: { name, position, day_tag: dayTag },
    })
    setShowAddDay(false)
  }

  function handleDeleteProgram(id: string) {
    deleteProgram.mutate(id)
    setSelectedProgramId(programs.find((p) => p.id !== id)?.id ?? null)
    setMobileView('list')
  }

  function handleDeleteDay(dayId: string) {
    deleteDayMutation.mutate(dayId)
  }

  function handleDeleteExercise(exId: string) {
    deleteExerciseMutation.mutate(exId)
  }

  function handleSelectProgram(id: string) {
    setSelectedProgramId(id)
    setMobileView('detail')
  }

  const isLoading = loadingPrograms || loadingExercises

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
        <div>
          <h1 className="text-base font-semibold text-foreground">{t.training.title}</h1>
          <p className="text-xs text-muted-foreground">{t.training.subtitle}</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowNewProgram(true)}>
          <Plus className="size-4" aria-hidden />
          <span className="hidden sm:inline">{t.training.newProgram}</span>
        </Button>
      </header>

      {/* Master-detail split */}
      <div className="flex min-h-0 flex-1">
        {/* Left panel — program list */}
        <div className={cn(
          'flex flex-col border-r border-border bg-background',
          'w-full lg:w-72 lg:shrink-0',
          mobileView === 'detail' ? 'hidden lg:flex' : 'flex',
        )}>
          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <LeftPanelSkeleton />
            ) : programs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <ClipboardList className="size-8 text-muted" aria-hidden />
                <p className="text-xs font-medium text-muted-foreground">{t.training.noPrograms}</p>
                <button
                  type="button"
                  onClick={() => setShowNewProgram(true)}
                  className="text-xs font-medium text-primary hover:opacity-70"
                >
                  {t.training.createFirst}
                </button>
              </div>
            ) : (
              <>
                {/* Section: My Programs */}
                <div className="mb-1">
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {t.training.myPrograms}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {myPrograms.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">None</p>
                    ) : (
                      myPrograms.map((p) => (
                        <ProgramRow
                          key={p.id}
                          program={p}
                          selected={p.id === selectedProgramId}
                          onSelect={() => handleSelectProgram(p.id)}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* Section: For athletes (trainer / gym_admin) */}
                {(role === 'trainer' || role === 'gym_admin') && (
                  <div className="mt-2">
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {t.training.forAthletes}
                    </p>
                    <div className="flex flex-col gap-0.5">
                      {forAthletes.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          No programs assigned to athletes
                        </p>
                      ) : (
                        forAthletes.map((p) => (
                          <ProgramRow
                            key={p.id}
                            program={p}
                            selected={p.id === selectedProgramId}
                            onSelect={() => handleSelectProgram(p.id)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right panel — program detail */}
        <div className={cn(
          'flex min-w-0 flex-col',
          'flex-1',
          mobileView === 'list' ? 'hidden lg:flex' : 'flex',
        )}>
          {isLoading ? (
            <RightPanelSkeleton />
          ) : !selectedProgram ? (
            <EmptyRightPanel onNew={() => setShowNewProgram(true)} />
          ) : (
            <ProgramDetail
              program={selectedProgram}
              exerciseMap={exerciseMap}
              allExercises={allExercises}
              canEdit={canEdit}
              currentUserId={currentUserId}
              role={role ?? 'athlete'}
              onDeleteProgram={handleDeleteProgram}
              onDeleteDay={handleDeleteDay}
              onDeleteExercise={handleDeleteExercise}
              onAddDay={() => setShowAddDay(true)}
              onBack={() => setMobileView('list')}
            />
          )}
        </div>
      </div>

      {/* Sheets */}
      <NewProgramSheet
        open={showNewProgram}
        onClose={() => { setShowNewProgram(false); setCreateProgramError(null) }}
        onCreate={handleCreateProgram}
        isCreating={createProgram.isPending}
        error={createProgramError}
      />
      <AddDaySheet
        open={showAddDay}
        onClose={() => setShowAddDay(false)}
        onAdd={handleAddDay}
        nextPosition={nextDayPosition}
        isAdding={addDayMutation.isPending}
      />
    </div>
  )
}
