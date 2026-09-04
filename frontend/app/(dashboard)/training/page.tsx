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
  Sparkles,
  BookOpen,
  Pencil,
  FileDown,
  MessageCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useRole } from '@/hooks/use-role'
import { useAuthStore } from '@/lib/auth/store'
import { useI18n } from '@/providers/i18n-provider'
import { useQueryClient } from '@tanstack/react-query'
import { usePrograms, useCreateProgram, useAssignProgram, useDeleteProgram, useAddDay, useDeleteDay, useDeleteProgramExercise, useUpdateProgram } from '@/hooks/training/use-programs'
import { addExerciseToDay, addPrescribedSet, replacePrescribedSets, updateProgramExercise, previewProgramHtml } from '@/lib/api/training'
import { useStartSession } from '@/hooks/logs/use-start-session'
import { useActiveSession } from '@/hooks/logs/use-active-session'
import { useAthleteActiveSession } from '@/hooks/logs/use-athlete-active-session'
import { deleteSession, startAthleteSession } from '@/lib/api/logs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useExerciseSearch } from '@/hooks/training/use-exercises'
import { useMyMemberships } from '@/hooks/identity/use-memberships'
import { useMyOrganization } from '@/hooks/identity/use-settings'
import { GenerateProgramSheet } from '@/components/ai/generate-program-sheet'
import { ExerciseVideoModal, VideoPreviewButton } from '@/components/training/exercise-video-modal'
import { ExerciseFormSheet } from '@/components/training/exercise-form-sheet'
import type { MembershipEnriched, Program, ProgramDay, ProgramExercise, PrescribedSet, DayTag, Exercise } from '@/types/api'

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
  const [videoDraft, setVideoDraft] = useState('')
  const [showVideo, setShowVideo] = useState(false)
  const [showExerciseForm, setShowExerciseForm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const videoUrl = ex.demo_video_url ?? exercise?.demo_video_url ?? null

  function openEdit() {
    const base = ex.prescribed_sets.length > 0
      ? ex.prescribed_sets.map((s) => ({
          rep_min: s.rep_min,
          rep_max: s.rep_max,
          rpe: s.rpe_target != null ? String(s.rpe_target) : '',
        }))
      : [{ rep_min: 8, rep_max: 12, rpe: '' }]
    setDrafts(base)
    setVideoDraft(ex.demo_video_url ?? '')
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
      const videoChanged = videoDraft.trim() !== (ex.demo_video_url ?? '')
      if (drafts.length > 0) {
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
      }
      if (videoChanged) {
        await updateProgramExercise(ex.id, { demo_video_url: videoDraft.trim() || null })
      }
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
        {videoUrl && (
          <button
            type="button"
            aria-label={`${t.training.watchDemo}: ${name}`}
            onClick={(e) => { e.stopPropagation(); setShowVideo(true) }}
            className="shrink-0 rounded-md p-1 text-primary transition-colors hover:bg-primary/10"
          >
            <Play className="size-3.5" aria-hidden />
          </button>
        )}
        {canEdit && exercise && !exercise.is_global && (
          <button
            type="button"
            aria-label={`${t.training.editExercise}: ${name}`}
            onClick={(e) => { e.stopPropagation(); setShowExerciseForm(true) }}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Pencil className="size-3.5" aria-hidden />
          </button>
        )}
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

          {/* Video URL for this exercise in the program */}
          <div className="mb-3 border-t border-border pt-3">
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              {t.training.videoUrlLabel}
            </label>
            <input
              type="url"
              value={videoDraft}
              onChange={(e) => setVideoDraft(e.target.value)}
              placeholder={t.training.videoUrlPlaceholder}
              className="w-full rounded border border-input bg-card px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="flex gap-2">
            <Button size="sm" className="flex-1" disabled={isSaving} onClick={save}>
              {isSaving && <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />}
              {t.training.saveSets}
            </Button>
            <Button size="sm" variant="outline" disabled={isSaving} onClick={() => setEditing(false)}>
              {t.common.cancel}
            </Button>
          </div>
        </div>
      )}
      {showVideo && videoUrl && (
        <ExerciseVideoModal
          url={videoUrl}
          exerciseName={name}
          onClose={() => setShowVideo(false)}
        />
      )}
      {showExerciseForm && exercise && !exercise.is_global && (
        <ExerciseFormSheet
          open={showExerciseForm}
          exercise={exercise}
          onClose={() => setShowExerciseForm(false)}
          onSuccess={() => setShowExerciseForm(false)}
        />
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
  const [formOpen, setFormOpen] = useState(false)
  const [editingExercise, setEditingExercise] = useState<Exercise | undefined>(undefined)
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
      <>
      <div className="mt-2 rounded-xl border border-border bg-card p-3 shadow-sm">
        {/* Header row: search + New exercise button */}
        <div className="mb-2 flex items-center gap-2">
          <Input
            ref={inputRef}
            placeholder={t.logs.searchExercises}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 flex-1 text-sm"
          />
          <button
            type="button"
            onClick={() => { setEditingExercise(undefined); setFormOpen(true) }}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
          >
            <Plus className="size-3" aria-hidden />
            {t.training.newExercise}
          </button>
        </div>
        <div className="max-h-40 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">{t.logs.noExercises}</p>
          ) : (
            filtered.slice(0, 20).map((ex) => (
              <div key={ex.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedEx(ex)}
                  className="flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent/50"
                >
                  <Dumbbell className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate text-foreground">{ex.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{ex.muscle_group}</span>
                </button>
                {ex.demo_video_url && (
                  <VideoPreviewButton url={ex.demo_video_url} name={ex.name} />
                )}
                {!ex.is_global && (
                  <button
                    type="button"
                    aria-label={`${t.training.editExercise}: ${ex.name}`}
                    onClick={(e) => { e.stopPropagation(); setEditingExercise(ex); setFormOpen(true) }}
                    className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="size-3" aria-hidden />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
        <div className="mt-2 flex justify-end">
          <button type="button" onClick={onClose} className="text-xs font-medium text-muted-foreground hover:text-foreground">
            {t.training.cancelAdd}
          </button>
        </div>
      </div>
      <ExerciseFormSheet
        open={formOpen}
        exercise={editingExercise}
        onClose={() => setFormOpen(false)}
        onSuccess={(ex) => {
          setFormOpen(false)
          if (!editingExercise) setSelectedEx(ex)
        }}
      />
      </>
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

// ── Client row (left panel) ───────────────────────────────────────────────────

interface ClientRowProps {
  athlete: MembershipEnriched
  programCount: number
  selected: boolean
  onSelect: () => void
}

function ClientRow({ athlete, programCount, selected, onSelect }: ClientRowProps) {
  const router = useRouter()
  const { t } = useI18n()
  const initials = athlete.athlete_email.slice(0, 2).toUpperCase()
  const { data: activeSession } = useAthleteActiveSession(athlete.athlete_id)

  return (
    <TooltipProvider delayDuration={300}>
      <div className="relative flex w-full items-center">
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            'relative flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent/50',
            selected && 'bg-accent',
          )}
        >
          {selected && (
            <span
              className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
              aria-hidden
            />
          )}
          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
            {initials}
            {activeSession && (
              <span
                className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-background bg-[color:var(--success)] animate-pulse"
                aria-hidden
              />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn('truncate text-sm font-medium', selected ? 'text-primary' : 'text-foreground')}>
              {athlete.athlete_email}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {activeSession
                ? <span className="text-[color:var(--success)] font-medium">{t.training.trainingNow}</span>
                : <>{programCount} program{programCount !== 1 ? 's' : ''}</>
              }
            </p>
          </div>
        </button>

        {/* Quick-resume shortcut — only visible when athlete has active session */}
        {activeSession && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t.training.resumeSession}
                onClick={(e) => { e.stopPropagation(); router.push(`/logs/${activeSession.id}`) }}
                className="mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[color:var(--success)] transition-colors hover:bg-[color:var(--success)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Play className="size-3.5 fill-current" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p className="font-medium">{t.training.trainingInProgress}</p>
              <p className="text-muted-foreground">{activeSession.name}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}

// ── Assigned program card (in athlete view) ───────────────────────────────────

interface AssignedProgramCardProps {
  program: Program
  onSelect: () => void
  onRemove: () => void
  isRemoving: boolean
}

function AssignedProgramCard({ program, onSelect, onRemove, isRemoving }: AssignedProgramCardProps) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const dayCount = program.days.length
  const exCount = totalExercises(program)

  return (
    <div className="rounded-xl border border-border bg-card transition-shadow hover:shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onSelect}
          className="group/card flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground group-hover/card:text-primary">{program.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {dayCount} day{dayCount !== 1 ? 's' : ''} · {exCount} exercise{exCount !== 1 ? 's' : ''}
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/card:translate-x-0.5 group-hover/card:text-primary" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Remove ${program.name}`}
          onClick={() => setConfirmRemove(true)}
          className="shrink-0 rounded-full bg-destructive/10 p-1.5 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      {confirmRemove && (
        <div className="mx-4 mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm font-medium text-foreground">Remove &ldquo;{program.name}&rdquo;?</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            This will permanently remove this program for the athlete.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setConfirmRemove(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isRemoving}
              onClick={() => { onRemove(); setConfirmRemove(false) }}
            >
              {isRemoving && <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />}
              Remove
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Pick template sheet (assign from client view) ─────────────────────────────

interface PickTemplateSheetProps {
  templates: Program[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onAssign: () => void
  onClose: () => void
  isAssigning: boolean
}

function PickTemplateSheet({ templates, selectedIds, onToggle, onAssign, onClose, isAssigning }: PickTemplateSheetProps) {
  const { t } = useI18n()

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-96 sm:-translate-x-1/2 sm:-translate-y-1/2"
        role="dialog"
        aria-modal
        aria-label={t.training.pickTemplate}
      >
        <div className="rounded-t-2xl border-t border-border bg-card p-6 shadow-xl sm:rounded-2xl sm:border">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">{t.training.pickTemplate}</h3>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {templates.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t.training.noProgramsToAssign}</p>
          ) : (
            <div className="mb-4 flex max-h-64 flex-col gap-1 overflow-y-auto">
              {templates.map((tmpl) => (
                <label
                  key={tmpl.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-accent/40"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(tmpl.id)}
                    onChange={() => onToggle(tmpl.id)}
                    className="size-4 rounded accent-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{tmpl.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {tmpl.days.length} day{tmpl.days.length !== 1 ? 's' : ''} · {totalExercises(tmpl)} exercise{totalExercises(tmpl) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={selectedIds.size === 0 || isAssigning || templates.length === 0}
              onClick={onAssign}
            >
              {isAssigning && <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />}
              {t.training.assignBtn}{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Athlete programs (right panel — client view) ──────────────────────────────

interface AthleteProgramsProps {
  athlete: MembershipEnriched
  programs: Program[]
  myTemplates: Program[]
  onSelectProgram: (id: string) => void
  onBack?: () => void
}

function AthletePrograms({ athlete, programs, myTemplates, onSelectProgram, onBack }: AthleteProgramsProps) {
  const { t } = useI18n()
  const [showPicker, setShowPicker] = useState(false)
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set())
  const assignProgram = useAssignProgram()
  const deleteProgram = useDeleteProgram()

  function toggleTemplate(id: string) {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleAssign() {
    for (const templateId of selectedTemplateIds) {
      await assignProgram.mutateAsync({
        programId: templateId,
        athleteIds: [athlete.athlete_id],
      })
    }
    setShowPicker(false)
    setSelectedTemplateIds(new Set())
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {onBack && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t.training.clients}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-foreground">{athlete.athlete_email}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {programs.length} program{programs.length !== 1 ? 's' : ''} assigned
            </p>
          </div>
          <Button
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => setShowPicker(true)}
          >
            <Plus className="size-4" aria-hidden />
            {t.training.assignProgram}
          </Button>
        </div>

        {programs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ClipboardList className="size-10 text-muted" aria-hidden />
            <p className="font-semibold text-foreground">{t.training.noAssignedPrograms}</p>
            <p className="text-sm text-muted-foreground">{t.training.noAssignedProgramsDesc}</p>
            <Button size="sm" onClick={() => setShowPicker(true)}>
              <Plus className="mr-1.5 size-4" aria-hidden />
              {t.training.assignProgram}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {programs.map((p) => (
              <AssignedProgramCard
                key={p.id}
                program={p}
                onSelect={() => onSelectProgram(p.id)}
                onRemove={() => deleteProgram.mutate(p.id)}
                isRemoving={deleteProgram.isPending && deleteProgram.variables === p.id}
              />
            ))}
          </div>
        )}
      </div>

      {showPicker && (
        <PickTemplateSheet
          templates={myTemplates}
          selectedIds={selectedTemplateIds}
          onToggle={toggleTemplate}
          onAssign={handleAssign}
          onClose={() => { setShowPicker(false); setSelectedTemplateIds(new Set()) }}
          isAssigning={assignProgram.isPending}
        />
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
  athletes: MembershipEnriched[]
  onDeleteProgram: (id: string) => void
  onDeleteDay: (dayId: string) => void
  onDeleteExercise: (exId: string) => void
  onAddDay: () => void
  /** Called when user taps "back"; label changes based on context */
  onBack?: () => void
  backLabel?: string
  /** When set, this ProgramDetail is being used to start a session for an athlete (trainer flow) */
  athleteId?: string
}

function ProgramDetail({
  program, exerciseMap, allExercises, canEdit, currentUserId, role, athletes,
  onDeleteProgram, onDeleteDay, onDeleteExercise, onAddDay, onBack, backLabel, athleteId,
}: ProgramDetailProps) {
  const { t } = useI18n()
  const [startingDayId, setStartingDayId] = useState<string | null>(null)
  const [confirmDeleteProgram, setConfirmDeleteProgram] = useState(false)
  const [activeSessionConflict, setActiveSessionConflict] = useState(false)
  const [pendingDay, setPendingDay] = useState<ProgramDay | null>(null)
  const [isDiscarding, setIsDiscarding] = useState(false)
  const [showAssignPanel, setShowAssignPanel] = useState(false)
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<Set<string>>(new Set())
  const [editingGuidelines, setEditingGuidelines] = useState(false)
  const [guidelinesValue, setGuidelinesValue] = useState(program.guidelines ?? '')
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionValue, setDescriptionValue] = useState(program.description ?? '')
  const router = useRouter()
  const startSession = useStartSession()
  const queryClient = useQueryClient()
  const activeSession = useActiveSession()
  const athleteActiveSession = useAthleteActiveSession(athleteId)
  const assignProgram = useAssignProgram()
  const updateProgram = useUpdateProgram()

  const canEditGuidelines = role === 'trainer' || role === 'gym_admin'

  const [showExportMenu, setShowExportMenu] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  function buildWhatsAppText(): string {
    let msg = `*${program.name}*`
    if (program.description) msg += `\n_${program.description}_`
    msg += '\n\n'
    for (const day of sortedDays) {
      msg += `*${day.name}*\n`
      const dayExercises = [...day.exercises].sort((a, b) => a.position - b.position)
      for (const pe of dayExercises) {
        const ex = exerciseMap.get(pe.exercise_id)
        const name = ex?.name ?? 'Exercise'
        const sets = pe.prescribed_sets
        if (sets.length > 0) {
          const first = sets[0]
          const reps = first.rep_min === first.rep_max ? `${first.rep_min}` : `${first.rep_min}–${first.rep_max}`
          const rpe = first.rpe_target ? ` @ RPE ${first.rpe_target}` : ''
          msg += `  • ${name} — ${sets.length} × ${reps} reps${rpe}\n`
        } else {
          msg += `  • ${name}\n`
        }
      }
      msg += '\n'
    }
    return msg.trim()
  }

  async function handleOpenPreview() {
    setIsLoadingPreview(true)
    setShowExportMenu(false)
    try {
      const blob = await previewProgramHtml(program.id)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 15000)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  function handleShareWhatsApp() {
    setShowExportMenu(false)
    const text = encodeURIComponent(buildWhatsAppText())
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  async function handleSaveGuidelines() {
    await updateProgram.mutateAsync({
      id: program.id,
      payload: { guidelines: guidelinesValue.trim() || null },
    })
    setEditingGuidelines(false)
  }

  async function handleSaveDescription() {
    await updateProgram.mutateAsync({
      id: program.id,
      payload: { description: descriptionValue.trim() || null },
    })
    setEditingDescription(false)
  }

  const sortedDays = [...program.days].sort((a, b) => a.position - b.position)

  const isAssignedToOther =
    program.athlete_id && program.athlete_id !== currentUserId

  // Only show assign panel for trainer's own templates, not for copies assigned to athletes
  const canAssign =
    (role === 'trainer' || role === 'gym_admin') &&
    athletes.length > 0 &&
    (!program.athlete_id || program.athlete_id === currentUserId)
  const assignedAthlete = athletes.find((m) => m.athlete_id === program.athlete_id)

  function toggleAthlete(athleteId: string) {
    setSelectedAthleteIds((prev) => {
      const next = new Set(prev)
      next.has(athleteId) ? next.delete(athleteId) : next.add(athleteId)
      return next
    })
  }

  async function handleAssign() {
    if (selectedAthleteIds.size === 0) return
    await assignProgram.mutateAsync({
      programId: program.id,
      athleteIds: [...selectedAthleteIds],
    })
    setShowAssignPanel(false)
    setSelectedAthleteIds(new Set())
  }

  async function handleStartSession(day: ProgramDay) {
    setStartingDayId(day.id)
    setActiveSessionConflict(false)
    try {
      const payload = {
        mode: 'program_driven' as const,
        program_day_id: day.id,
        name: day.name,
        day_tag: day.day_tag,
      }
      const session = athleteId
        ? await startAthleteSession(athleteId, payload)
        : await startSession.mutateAsync(payload)
      if (athleteId) {
        await queryClient.invalidateQueries({ queryKey: ['logs', 'athlete-active', athleteId] })
      }
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
      {/* Back button */}
      {onBack && (
        <div className={cn(
          'flex items-center gap-2 border-b border-border px-4 py-3',
          // Hide on desktop when going back to programs list (left panel is always visible)
          // but always show when going back to an athlete view
          !backLabel || backLabel === t.training.myPrograms ? 'lg:hidden' : '',
        )}>
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {backLabel ?? t.training.myPrograms}
          </button>
        </div>
      )}

      {/* Athlete active session banner — shown when trainer has selected an athlete and that athlete has an ongoing session */}
      {athleteId && athleteActiveSession.data && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-accent/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <Play className="size-4 shrink-0 text-primary" aria-hidden />
            <p className="text-sm font-medium text-foreground">
              {athleteActiveSession.data.name}
              <span className="ml-1.5 text-muted-foreground font-normal">{t.logs.activeSession}</span>
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => router.push(`/logs/${athleteActiveSession.data!.id}`)}
          >
            {t.logs.continueSession}
          </Button>
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
            {editingDescription ? (
              <div className="mt-2 flex flex-col gap-2">
                <Textarea
                  placeholder={t.training.descriptionPlaceholder}
                  value={descriptionValue}
                  onChange={(e) => setDescriptionValue(e.target.value)}
                  className="min-h-[72px] text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveDescription}
                    disabled={updateProgram.isPending}
                  >
                    {updateProgram.isPending && (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                    )}
                    {t.training.saveDescription}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingDescription(false)
                      setDescriptionValue(program.description ?? '')
                    }}
                  >
                    {t.common.cancel}
                  </Button>
                </div>
              </div>
            ) : program.description ? (
              <div className="mt-1 flex items-start gap-1.5">
                <p className="text-sm text-muted-foreground">{program.description}</p>
                {canEditGuidelines && (
                  <button
                    type="button"
                    onClick={() => {
                      setDescriptionValue(program.description ?? '')
                      setEditingDescription(true)
                    }}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={t.training.editDescription}
                  >
                    <Pencil className="size-3" aria-hidden />
                  </button>
                )}
              </div>
            ) : canEditGuidelines ? (
              <button
                type="button"
                onClick={() => setEditingDescription(true)}
                className="mt-1 text-xs text-muted-foreground hover:text-foreground"
              >
                + {t.training.editDescription}
              </button>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">
              {sortedDays.length} day{sortedDays.length !== 1 ? 's' : ''} · {totalExercises(program)} exercise{totalExercises(program) !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Export / Share — always visible */}
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                disabled={isLoadingPreview}
                onClick={() => setShowExportMenu((v) => !v)}
                className="gap-1.5"
              >
                {isLoadingPreview
                  ? <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  : <FileDown className="size-3.5" aria-hidden />
                }
                {t.training.exportProgram}
              </Button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-9 z-20 w-52 rounded-xl border border-border bg-card py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={handleOpenPreview}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent/50"
                    >
                      <FileDown className="size-3.5 text-muted-foreground" aria-hidden />
                      {t.training.previewPdf}
                    </button>
                    <button
                      type="button"
                      onClick={handleShareWhatsApp}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent/50"
                    >
                      <MessageCircle className="size-3.5 text-green-600" aria-hidden />
                      {t.training.shareWhatsApp}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Delete — editors only */}
            {canEdit && (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* Assign-to-athlete section (trainer/admin only) */}
        {canAssign && (
          <div className="mb-4">
            {/* Banner when the program itself is assigned to someone else */}
            {isAssignedToOther && (
              <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                <User className="size-4 shrink-0 text-primary" aria-hidden />
                <p className="truncate text-sm text-foreground">
                  {t.training.assignedTo}: <span className="font-medium">{assignedAthlete?.athlete_email ?? program.athlete_id}</span>
                </p>
              </div>
            )}

            {/* Assign / assign-to-more button */}
            {!showAssignPanel && (
              <button
                type="button"
                onClick={() => setShowAssignPanel(true)}
                className="flex items-center gap-1.5 rounded-xl border border-dashed border-primary/30 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:border-primary/60 hover:bg-primary/5"
              >
                <User className="size-4" aria-hidden />
                {t.training.assignToAthlete}
              </button>
            )}

            {/* Multi-select panel */}
            {showAssignPanel && (
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <p className="mb-3 text-sm font-medium text-foreground">{t.training.assignToAthlete}</p>
                <div className="mb-3 flex flex-col gap-1.5">
                  {athletes.map((m) => (
                    <label
                      key={m.athlete_id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent/40"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAthleteIds.has(m.athlete_id)}
                        onChange={() => toggleAthlete(m.athlete_id)}
                        className="size-4 rounded accent-primary"
                      />
                      <span className="text-sm text-foreground">{m.athlete_email}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={selectedAthleteIds.size === 0 || assignProgram.isPending}
                    onClick={handleAssign}
                  >
                    {assignProgram.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />}
                    {t.training.assignBtn}
                    {selectedAthleteIds.size > 0 && ` (${selectedAthleteIds.size})`}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setShowAssignPanel(false); setSelectedAthleteIds(new Set()) }}
                  >
                    {t.common.cancel}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Guidelines */}
        {editingGuidelines ? (
          <div className="mb-6 flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <BookOpen className="size-4" aria-hidden />
              {t.training.guidelines}
            </label>
            <Textarea
              placeholder={t.training.guidelinesPlaceholder}
              value={guidelinesValue}
              onChange={(e) => setGuidelinesValue(e.target.value)}
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">{t.training.guidelinesHint}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveGuidelines}
                disabled={updateProgram.isPending}
              >
                {updateProgram.isPending && (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                )}
                {t.training.saveGuidelines}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingGuidelines(false)
                  setGuidelinesValue(program.guidelines ?? '')
                }}
              >
                {t.common.cancel}
              </Button>
            </div>
          </div>
        ) : program.guidelines ? (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  {t.training.guidelines}
                </h3>
              </div>
              {canEditGuidelines && (
                <button
                  type="button"
                  onClick={() => {
                    setGuidelinesValue(program.guidelines ?? '')
                    setEditingGuidelines(true)
                  }}
                  className="flex items-center gap-1 text-xs text-amber-700 transition-colors hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
                  aria-label={t.training.editGuidelines}
                >
                  <Pencil className="size-3" aria-hidden />
                  {t.training.editGuidelines}
                </button>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm text-amber-800 dark:text-amber-200">
              {program.guidelines}
            </p>
          </div>
        ) : canEditGuidelines ? (
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">
              {t.training.noGuidelines}{' '}
              <button
                type="button"
                onClick={() => setEditingGuidelines(true)}
                className="font-medium text-primary hover:underline"
              >
                + {t.training.editGuidelines}
              </button>
            </p>
          </div>
        ) : null}

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
  athleteEmail?: string
  onSelect: () => void
}

function ProgramRow({ program, selected, athleteEmail, onSelect }: ProgramRowProps) {
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
      {athleteEmail && (
        <p className="text-[10px] text-primary/70 truncate w-full">
          {athleteEmail}
        </p>
      )}
    </button>
  )
}

// ── New Program sheet ─────────────────────────────────────────────────────────

interface NewProgramSheetProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string, description: string, athleteId?: string) => void
  isCreating: boolean
  error?: string | null
  athletes?: MembershipEnriched[]
}

function NewProgramSheet({ open, onClose, onCreate, isCreating, error, athletes }: NewProgramSheetProps) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedAthleteId, setSelectedAthleteId] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onCreate(name.trim(), description.trim(), selectedAthleteId || undefined)
  }

  useEffect(() => {
    if (!open) { setName(''); setDescription(''); setSelectedAthleteId('') }
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
            {athletes && athletes.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="prog-athlete" className="text-sm font-medium text-foreground">
                  {t.training.assignToAthlete}
                </label>
                <select
                  id="prog-athlete"
                  value={selectedAthleteId}
                  onChange={(e) => setSelectedAthleteId(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">{t.training.forMyself}</option>
                  {athletes.map((m) => (
                    <option key={m.athlete_id} value={m.athlete_id}>
                      {m.athlete_email}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
  const { data: myMemberships = [] } = useMyMemberships()
  const myAthletes = role === 'trainer' ? myMemberships : []
  const { data: myOrg } = useMyOrganization()

  const exerciseMap = new Map(allExercises.map((e) => [e.id, e]))

  const createProgram = useCreateProgram()
  const deleteProgram = useDeleteProgram()
  const addDayMutation = useAddDay()
  const deleteDayMutation = useDeleteDay()
  const deleteExerciseMutation = useDeleteProgramExercise()

  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null)
  const [showNewProgram, setShowNewProgram] = useState(false)
  const [showGenerateAI, setShowGenerateAI] = useState(false)
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
  const selectedAthlete = myAthletes.find((m) => m.athlete_id === selectedAthleteId) ?? null
  const athletePrograms = selectedAthleteId
    ? forAthletes.filter((p) => p.athlete_id === selectedAthleteId)
    : []

  // Auto-select first program when list loads (desktop only — on mobile stay on list view)
  useEffect(() => {
    if (!selectedProgramId && !selectedAthleteId && programs.length > 0) {
      setSelectedProgramId(programs[0].id)
    }
  }, [programs, selectedProgramId, selectedAthleteId])

  const canEdit =
    role === 'trainer' || role === 'gym_admin' ||
    (role === 'athlete' && !!selectedProgram && selectedProgram.athlete_id === currentUserId)

  const nextDayPosition = selectedProgram ? selectedProgram.days.length + 1 : 1

  async function handleCreateProgram(name: string, description: string, athleteId?: string) {
    setCreateProgramError(null)
    try {
      const prog = await createProgram.mutateAsync({
        name,
        description,
        mode: 'program_driven',
        athlete_id: athleteId,
      })
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
    if (selectedAthleteId) {
      // In client view: stay on client view after deletion
      setSelectedProgramId(null)
    } else {
      setSelectedProgramId(programs.find((p) => p.id !== id)?.id ?? null)
      setMobileView('list')
    }
  }

  function handleDeleteDay(dayId: string) {
    deleteDayMutation.mutate(dayId)
  }

  function handleDeleteExercise(exId: string) {
    deleteExerciseMutation.mutate(exId)
  }

  function handleSelectProgram(id: string) {
    setSelectedProgramId(id)
    setSelectedAthleteId(null)
    setMobileView('detail')
  }

  function handleSelectAthlete(athleteId: string) {
    setSelectedAthleteId(athleteId)
    setSelectedProgramId(null)
    setMobileView('detail')
  }

  function handleSelectAthleteProgram(id: string) {
    setSelectedProgramId(id)
    // Keep selectedAthleteId so "back" returns to client view
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGenerateAI(true)}
            className="flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/40"
          >
            <Sparkles className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">{t.training.generateWithAI}</span>
          </button>
          <Button size="sm" className="gap-1.5" onClick={() => setShowNewProgram(true)}>
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">{t.training.newProgram}</span>
          </Button>
        </div>
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

                {/* Section: Clients (trainer / gym_admin) */}
                {(role === 'trainer' || role === 'gym_admin') && myAthletes.length > 0 && (
                  <div className="mt-2">
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {t.training.clients}
                    </p>
                    <div className="flex flex-col gap-0.5">
                      {myAthletes.map((m) => {
                        const count = forAthletes.filter((p) => p.athlete_id === m.athlete_id).length
                        return (
                          <ClientRow
                            key={m.athlete_id}
                            athlete={m}
                            programCount={count}
                            selected={selectedAthleteId === m.athlete_id && !selectedProgramId}
                            onSelect={() => handleSelectAthlete(m.athlete_id)}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right panel — athlete view or program detail */}
        <div className={cn(
          'flex min-w-0 flex-col',
          'flex-1',
          mobileView === 'list' ? 'hidden lg:flex' : 'flex',
        )}>
          {isLoading ? (
            <RightPanelSkeleton />
          ) : selectedAthlete && !selectedProgramId ? (
            <AthletePrograms
              athlete={selectedAthlete}
              programs={athletePrograms}
              myTemplates={myPrograms}
              onSelectProgram={handleSelectAthleteProgram}
              onBack={() => setMobileView('list')}
            />
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
              athletes={myAthletes}
              onDeleteProgram={handleDeleteProgram}
              onDeleteDay={handleDeleteDay}
              onDeleteExercise={handleDeleteExercise}
              onAddDay={() => setShowAddDay(true)}
              onBack={selectedAthleteId
                ? () => setSelectedProgramId(null)
                : () => setMobileView('list')
              }
              backLabel={selectedAthlete?.athlete_email ?? t.training.myPrograms}
              athleteId={selectedAthleteId ?? undefined}
            />
          )}
        </div>
      </div>

      {/* Sheets */}
      <GenerateProgramSheet
        open={showGenerateAI}
        onClose={() => setShowGenerateAI(false)}
        onSuccess={(id) => { setSelectedProgramId(id); setMobileView('detail') }}
        isPro={myOrg?.plan === 'pro'}
        athletes={myAthletes}
        role={role ?? 'athlete'}
      />
      <NewProgramSheet
        open={showNewProgram}
        onClose={() => { setShowNewProgram(false); setCreateProgramError(null) }}
        onCreate={handleCreateProgram}
        isCreating={createProgram.isPending}
        error={createProgramError}
        athletes={myAthletes}
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
