'use client'
import { useEffect, useRef, useState } from 'react'
import { Dumbbell, Link, Upload, X } from 'lucide-react'
import type { AxiosError } from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/providers/i18n-provider'
import { useCreateExercise } from '@/hooks/training/use-exercises'
import { useUpdateExercise } from '@/hooks/training/use-exercises'
import { useUploadExerciseVideo } from '@/hooks/training/use-exercises'
import type { Exercise, MuscleGroup, Equipment, MovementPattern } from '@/types/api'

const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'core', 'quads', 'hamstrings', 'glutes', 'calves', 'full_body',
]

const EQUIPMENT: Equipment[] = [
  'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'bands', 'other',
]

const MOVEMENT_PATTERNS: MovementPattern[] = [
  'push', 'pull', 'squat', 'hinge', 'carry', 'rotation', 'isolation',
]

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps',
  triceps: 'Triceps', forearms: 'Forearms', core: 'Core', quads: 'Quads',
  hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', full_body: 'Full body',
}

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell', dumbbell: 'Dumbbell', machine: 'Machine', cable: 'Cable',
  bodyweight: 'Bodyweight', kettlebell: 'Kettlebell', bands: 'Bands', other: 'Other',
}

const MOVEMENT_LABELS: Record<MovementPattern, string> = {
  push: 'Push', pull: 'Pull', squat: 'Squat', hinge: 'Hinge',
  carry: 'Carry', rotation: 'Rotation', isolation: 'Isolation',
}

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
const MAX_VIDEO_BYTES = 200 * 1024 * 1024

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: (exercise: Exercise) => void
  exercise?: Exercise
}

export function ExerciseFormSheet({ open, onClose, onSuccess, exercise }: Props) {
  const { t } = useI18n()
  const isEdit = !!exercise

  const [name, setName] = useState('')
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('chest')
  const [equipment, setEquipment] = useState<Equipment>('barbell')
  const [movementPattern, setMovementPattern] = useState<MovementPattern>('push')
  const [isBilateral, setIsBilateral] = useState(true)
  const [notes, setNotes] = useState('')
  const [videoTab, setVideoTab] = useState<'link' | 'upload'>('link')
  const [videoUrl, setVideoUrl] = useState('')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const createMut = useCreateExercise()
  const updateMut = useUpdateExercise()
  const uploadMut = useUploadExerciseVideo()

  const isSubmitting = createMut.isPending || updateMut.isPending || uploadMut.isPending

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setName(exercise?.name ?? '')
      setMuscleGroup(exercise?.muscle_group ?? 'chest')
      setEquipment(exercise?.equipment ?? 'barbell')
      setMovementPattern(exercise?.movement_pattern ?? 'push')
      setIsBilateral(exercise?.is_bilateral ?? true)
      setNotes(exercise?.notes ?? '')
      setVideoTab('link')
      setVideoUrl(exercise?.demo_video_url ?? '')
      setVideoFile(null)
      setFileError(null)
      setError(null)
      createMut.reset()
      updateMut.reset()
      uploadMut.reset()
    }
  }, [open, exercise?.id])

  // Escape key to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isSubmitting) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, isSubmitting])

  if (!open) return null

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setFileError(null)
    if (!file) { setVideoFile(null); return }
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      setFileError(t.training.videoInvalidType)
      setVideoFile(null)
      return
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setFileError(t.training.videoTooLarge)
      setVideoFile(null)
      return
    }
    setVideoFile(file)
  }

  async function handleSubmit() {
    const trimmedName = name.trim()
    if (!trimmedName) return
    setError(null)
    try {
      let saved: Exercise
      if (isEdit && exercise) {
        saved = await updateMut.mutateAsync({
          id: exercise.id,
          payload: {
            name: trimmedName,
            muscle_group: muscleGroup,
            equipment,
            movement_pattern: movementPattern,
            is_bilateral: isBilateral,
            notes: notes.trim() || null,
            demo_video_url: videoTab === 'link' ? (videoUrl.trim() || null) : exercise.demo_video_url,
          },
        })
      } else {
        saved = await createMut.mutateAsync({
          name: trimmedName,
          muscle_group: muscleGroup,
          equipment,
          movement_pattern: movementPattern,
          is_bilateral: isBilateral,
          notes: notes.trim() || undefined,
          demo_video_url: videoTab === 'link' ? (videoUrl.trim() || null) : null,
        })
      }
      if (videoTab === 'upload' && videoFile) {
        saved = await uploadMut.mutateAsync({ id: saved.id, file: videoFile })
      }
      onSuccess?.(saved)
      onClose()
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string }>
      setError(axiosErr?.response?.data?.detail ?? 'Something went wrong. Please try again.')
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={!isSubmitting ? onClose : undefined} aria-hidden />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[480px] sm:-translate-x-1/2 sm:-translate-y-1/2"
        role="dialog"
        aria-modal
        aria-label={isEdit ? t.training.editExercise : t.training.createExercise}
      >
        <div className="max-h-[92dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-card shadow-xl sm:max-h-[90vh] sm:rounded-2xl sm:border">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-2">
              <Dumbbell className="size-4 text-primary" aria-hidden />
              <h3 className="text-base font-semibold text-foreground">
                {isEdit ? t.training.editExercise : t.training.createExercise}
              </h3>
            </div>
            <button
              type="button"
              aria-label={t.common.close}
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="space-y-4 px-5 pb-6">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                {t.training.exerciseNameLabel} <span className="text-destructive">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.training.exerciseNamePlaceholder}
                className="h-9 text-sm"
                autoFocus
              />
            </div>

            {/* Muscle group + Equipment (side by side) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t.training.muscleGroupLabel}</label>
                <Select value={muscleGroup} onValueChange={(v) => setMuscleGroup(v as MuscleGroup)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MUSCLE_GROUPS.map((mg) => (
                      <SelectItem key={mg} value={mg}>{MUSCLE_LABELS[mg]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t.training.equipmentLabel}</label>
                <Select value={equipment} onValueChange={(v) => setEquipment(v as Equipment)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT.map((eq) => (
                      <SelectItem key={eq} value={eq}>{EQUIPMENT_LABELS[eq]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Movement pattern + Bilateral */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t.training.movementPatternLabel}</label>
                <Select value={movementPattern} onValueChange={(v) => setMovementPattern(v as MovementPattern)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOVEMENT_PATTERNS.map((mp) => (
                      <SelectItem key={mp} value={mp}>{MOVEMENT_LABELS[mp]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-0.5">
                <button
                  type="button"
                  onClick={() => setIsBilateral((v) => !v)}
                  className={`flex h-9 w-full items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors ${
                    isBilateral
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent'
                  }`}
                >
                  <span className={`size-3 rounded-full ${isBilateral ? 'bg-primary' : 'bg-muted'}`} />
                  {t.training.isBilateralLabel}
                </button>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t.health.notes}</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Keep back neutral throughout the movement."
                className="min-h-[72px] resize-none text-sm"
              />
            </div>

            {/* Video section */}
            <div className="space-y-2">
              <div className="flex gap-1 rounded-lg bg-secondary p-1">
                <button
                  type="button"
                  onClick={() => setVideoTab('link')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    videoTab === 'link'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Link className="size-3" aria-hidden />
                  {t.training.linkVideoTab}
                </button>
                <button
                  type="button"
                  onClick={() => setVideoTab('upload')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    videoTab === 'upload'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Upload className="size-3" aria-hidden />
                  {t.training.uploadVideoTab}
                </button>
              </div>

              {videoTab === 'link' ? (
                <div className="space-y-1.5">
                  <Input
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder={t.training.videoUrlPlaceholder}
                    className="h-9 text-sm"
                    type="url"
                  />
                  <p className="text-xs text-muted-foreground">{t.training.videoUrlHint}</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <Upload className="size-4" aria-hidden />
                    {videoFile ? videoFile.name : 'Choose video file…'}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="video/*"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                  {videoFile && (
                    <p className="text-xs text-muted-foreground">
                      {(videoFile.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  )}
                  {fileError && (
                    <p className="text-xs text-destructive">{fileError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{t.training.videoUrlHint} · max 200 MB</p>
                </div>
              )}
            </div>

            {/* API error */}
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={!name.trim() || isSubmitting || !!fileError}
              >
                {isSubmitting ? t.common.loading : t.training.saveExercise}
              </Button>
              <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                {t.common.cancel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
