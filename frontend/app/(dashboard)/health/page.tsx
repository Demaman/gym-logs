'use client'

import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Plus, Pencil, Trash2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/providers/i18n-provider'
import {
  useAthleteProfile, useUpdateProfile,
  useMeasurements, useCreateMeasurement, useUpdateMeasurement, useDeleteMeasurement,
} from '@/hooks/analytics/use-anamnesis'
import { useOrgAthletes } from '@/hooks/identity/use-org-athletes'
import { useRole } from '@/hooks/use-role'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type {
  AthleteProfileUpdateRequest, BodyMeasurementCreateRequest,
  SexType, DominantSide, CompetitionLevel, GoalType, BfMethod,
  BodyMeasurement, User,
} from '@/types/api'
import { cn } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

function n(s: string | undefined): number | null {
  if (!s || s.trim() === '') return null
  const v = parseFloat(s)
  return isNaN(v) ? null : v
}

function ni(s: string | undefined): number | null {
  if (!s || s.trim() === '') return null
  const v = parseInt(s, 10)
  return isNaN(v) ? null : v
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  date_of_birth: z.string().optional(),
  sex: z.enum(['male', 'female', 'other']).optional(),
  dominant_side: z.enum(['left', 'right']).optional(),
  height_cm: z.string().optional(),
  training_age_years: z.string().optional(),
  training_frequency_available: z.string().optional(),
  primary_sport: z.string().max(255).optional(),
  competition_level: z.enum(['recreational', 'amateur', 'competitive', 'elite']).optional(),
  primary_goal: z.enum(['strength', 'hypertrophy', 'fat_loss', 'endurance', 'sport_performance', 'general_fitness']).optional(),
  target_event_date: z.string().optional(),
  parq_cleared: z.boolean().optional(),
  injury_history: z.string().optional(),
  surgeries: z.string().optional(),
  chronic_conditions: z.string().optional(),
  medications: z.string().optional(),
  contraindications: z.string().optional(),
})

const measurementSchema = z.object({
  measured_at: z.string().min(1, 'Date is required'),
  weight_kg: z.string().optional(),
  body_fat_pct: z.string().optional(),
  lean_mass_kg: z.string().optional(),
  bf_method: z.enum(['dexa', 'skinfold', 'bioimpedance', 'navy_formula', 'visual']).optional(),
  waist_cm: z.string().optional(),
  hip_cm: z.string().optional(),
  chest_cm: z.string().optional(),
  upper_arm_cm: z.string().optional(),
  thigh_cm: z.string().optional(),
  calf_cm: z.string().optional(),
  resting_hr: z.string().optional(),
  bp_systolic: z.string().optional(),
  bp_diastolic: z.string().optional(),
  notes: z.string().optional(),
})

type ProfileForm = z.infer<typeof profileSchema>
type MeasurementForm = z.infer<typeof measurementSchema>

// ── Small reusable components ─────────────────────────────────────────────────

function SectionHeader({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex w-full items-center justify-between rounded-lg px-4 py-3 text-left transition-colors duration-150',
        open
          ? 'bg-accent text-accent-foreground'
          : 'bg-secondary hover:bg-accent/60 text-foreground',
      )}
    >
      <h3 className="text-sm font-semibold tracking-wide">{title}</h3>
      <ChevronDown
        className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
      />
    </button>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

// ── Profile section ───────────────────────────────────────────────────────────

function profileToForm(profile: import('@/types/api').AthleteProfile): ProfileForm {
  return {
    date_of_birth: profile.date_of_birth ?? '',
    sex: profile.sex ?? undefined,
    dominant_side: profile.dominant_side ?? undefined,
    height_cm: profile.height_cm != null ? String(profile.height_cm) : '',
    training_age_years: profile.training_age_years != null ? String(profile.training_age_years) : '',
    training_frequency_available: profile.training_frequency_available != null ? String(profile.training_frequency_available) : '',
    primary_sport: profile.primary_sport ?? '',
    competition_level: profile.competition_level ?? undefined,
    primary_goal: profile.primary_goal ?? undefined,
    target_event_date: profile.target_event_date ?? '',
    parq_cleared: profile.parq_cleared ?? false,
    injury_history: profile.injury_history ?? '',
    surgeries: profile.surgeries ?? '',
    chronic_conditions: profile.chronic_conditions ?? '',
    medications: profile.medications ?? '',
    contraindications: profile.contraindications ?? '',
  }
}

function ProfileSection({ athleteId }: { athleteId?: string | null }) {
  const { t } = useI18n()
  const h = t.health
  const { data: profile, isLoading } = useAthleteProfile(athleteId)
  const update = useUpdateProfile(athleteId)

  const [openSections, setOpenSections] = useState({
    general: true, training: false, health: false, goals: false,
  })
  const [savedOk, setSavedOk] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function toggle(key: keyof typeof openSections) {
    setOpenSections(s => ({ ...s, [key]: !s[key] }))
  }

  const { register, handleSubmit, control, reset, formState: { isSubmitting, isDirty } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      date_of_birth: '', sex: undefined, dominant_side: undefined,
      height_cm: '', training_age_years: '', training_frequency_available: '',
      primary_sport: '', competition_level: undefined, primary_goal: undefined,
      target_event_date: '', parq_cleared: false,
      injury_history: '', surgeries: '', chronic_conditions: '',
      medications: '', contraindications: '',
    },
  })

  // Populate once when profile loads; use id+updated_at as the key so background
  // refetches with identical data don't reset user's in-progress edits.
  const profileKey = profile ? `${profile.id}:${profile.updated_at}` : null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (profile) reset(profileToForm(profile)) }, [profileKey])

  async function onSubmit(data: ProfileForm) {
    setSaveError(null)
    const payload: AthleteProfileUpdateRequest = {
      date_of_birth: data.date_of_birth || null,
      sex: (data.sex as SexType) ?? null,
      dominant_side: (data.dominant_side as DominantSide) ?? null,
      height_cm: n(data.height_cm),
      training_age_years: ni(data.training_age_years),
      training_frequency_available: ni(data.training_frequency_available),
      primary_sport: data.primary_sport || null,
      competition_level: (data.competition_level as CompetitionLevel) ?? null,
      primary_goal: (data.primary_goal as GoalType) ?? null,
      target_event_date: data.target_event_date || null,
      parq_cleared: data.parq_cleared ?? false,
      injury_history: data.injury_history || null,
      surgeries: data.surgeries || null,
      chronic_conditions: data.chronic_conditions || null,
      medications: data.medications || null,
      contraindications: data.contraindications || null,
    }
    try {
      await update.mutateAsync(payload)
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 3000)
    } catch {
      setSaveError(t.common.save + ' failed')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-card p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-2/3" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 text-base font-semibold">{h.profile}</h2>

      <div className="space-y-1">
      {/* General */}
      <div>
        <SectionHeader title={h.sectionGeneral} open={openSections.general} onToggle={() => toggle('general')} />
        {openSections.general && (
          <div className="mt-3 px-1 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldRow label={h.dateOfBirth}>
              <Input type="date" {...register('date_of_birth')} className="h-9" />
            </FieldRow>
            <FieldRow label={h.sex}>
              <Controller name="sex" control={control} render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={(v: string) => field.onChange(v || undefined)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="–" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{h.sexMale}</SelectItem>
                    <SelectItem value="female">{h.sexFemale}</SelectItem>
                    <SelectItem value="other">{h.sexOther}</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </FieldRow>
            <FieldRow label={h.heightCm}>
              <Input type="number" min={50} max={250} step={0.1} placeholder="e.g. 175" {...register('height_cm')} className="h-9" />
            </FieldRow>
            <FieldRow label={h.dominantSide}>
              <Controller name="dominant_side" control={control} render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={(v: string) => field.onChange(v || undefined)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="–" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="right">{h.dominantRight}</SelectItem>
                    <SelectItem value="left">{h.dominantLeft}</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </FieldRow>
          </div>
        )}
      </div>

      {/* Training background */}
      <div>
        <SectionHeader title={h.sectionTraining} open={openSections.training} onToggle={() => toggle('training')} />
        {openSections.training && (
          <div className="mt-3 px-1 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldRow label={h.trainingAge}>
              <Input type="number" min={0} max={50} step={1} placeholder="e.g. 3" {...register('training_age_years')} className="h-9" />
            </FieldRow>
            <FieldRow label={h.trainingFrequency}>
              <Input type="number" min={1} max={7} step={1} placeholder="e.g. 4" {...register('training_frequency_available')} className="h-9" />
            </FieldRow>
            <FieldRow label={h.primarySport}>
              <Input {...register('primary_sport')} placeholder="e.g. Powerlifting" className="h-9" />
            </FieldRow>
            <FieldRow label={h.competitionLevel}>
              <Controller name="competition_level" control={control} render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={(v: string) => field.onChange(v || undefined)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="–" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recreational">{h.compRecreational}</SelectItem>
                    <SelectItem value="amateur">{h.compAmateur}</SelectItem>
                    <SelectItem value="competitive">{h.compCompetitive}</SelectItem>
                    <SelectItem value="elite">{h.compElite}</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </FieldRow>
          </div>
        )}
      </div>

      {/* Goals */}
      <div>
        <SectionHeader title={h.sectionGoals} open={openSections.goals} onToggle={() => toggle('goals')} />
        {openSections.goals && (
          <div className="mt-3 px-1 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldRow label={h.primaryGoal}>
              <Controller name="primary_goal" control={control} render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={(v: string) => field.onChange(v || undefined)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="–" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strength">{h.goalStrength}</SelectItem>
                    <SelectItem value="hypertrophy">{h.goalHypertrophy}</SelectItem>
                    <SelectItem value="fat_loss">{h.goalFatLoss}</SelectItem>
                    <SelectItem value="endurance">{h.goalEndurance}</SelectItem>
                    <SelectItem value="sport_performance">{h.goalSport}</SelectItem>
                    <SelectItem value="general_fitness">{h.goalFitness}</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </FieldRow>
            <FieldRow label={h.targetEventDate}>
              <Input type="date" {...register('target_event_date')} className="h-9" />
            </FieldRow>
          </div>
        )}
      </div>

      {/* Health history */}
      <div>
        <SectionHeader title={h.sectionHealth} open={openSections.health} onToggle={() => toggle('health')} />
        {openSections.health && (
          <div className="mt-3 px-1 space-y-4">
            <div className="flex items-center gap-3">
              <input
                id="parq"
                type="checkbox"
                {...register('parq_cleared')}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <Label htmlFor="parq" className="text-sm">{h.parqCleared}</Label>
            </div>
            <FieldRow label={h.injuryHistory}>
              <Textarea {...register('injury_history')} placeholder="e.g. Left ACL tear in 2022" rows={2} className="resize-none" />
            </FieldRow>
            <FieldRow label={h.surgeries}>
              <Textarea {...register('surgeries')} placeholder="e.g. Knee arthroscopy 2022" rows={2} className="resize-none" />
            </FieldRow>
            <FieldRow label={h.chronicConditions}>
              <Textarea {...register('chronic_conditions')} placeholder="e.g. Type 2 diabetes, hypertension" rows={2} className="resize-none" />
            </FieldRow>
            <FieldRow label={h.medications}>
              <Textarea {...register('medications')} placeholder="e.g. Metformin 500mg" rows={2} className="resize-none" />
            </FieldRow>
            <FieldRow label={h.contraindications}>
              <Textarea {...register('contraindications')} placeholder="e.g. Avoid high-impact exercises" rows={2} className="resize-none" />
            </FieldRow>
          </div>
        )}
      </div>
      </div>{/* end space-y-1 */}

      <div className="mt-6 flex items-center justify-end gap-3">
        {savedOk && <span className="text-sm text-green-600">{h.profileSaved}</span>}
        {saveError && <span className="text-sm text-destructive">{saveError}</span>}
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
          {isSubmitting ? h.savingProfile : t.common.save}
        </Button>
      </div>
    </form>
  )
}

// ── Measurement form dialog ───────────────────────────────────────────────────

function MeasurementDialog({
  open, onClose, existing, athleteId,
}: { open: boolean; onClose: () => void; existing?: BodyMeasurement; athleteId?: string | null }) {
  const { t } = useI18n()
  const h = t.health
  const create = useCreateMeasurement(athleteId)
  const update = useUpdateMeasurement(athleteId)

  const today = new Date().toISOString().split('T')[0]

  const { register, handleSubmit, control, formState: { isSubmitting } } = useForm<MeasurementForm>({
    resolver: zodResolver(measurementSchema),
    values: existing ? {
      measured_at: existing.measured_at,
      weight_kg: existing.weight_kg != null ? String(existing.weight_kg) : '',
      body_fat_pct: existing.body_fat_pct != null ? String(existing.body_fat_pct) : '',
      lean_mass_kg: existing.lean_mass_kg != null ? String(existing.lean_mass_kg) : '',
      bf_method: existing.bf_method ?? undefined,
      waist_cm: existing.waist_cm != null ? String(existing.waist_cm) : '',
      hip_cm: existing.hip_cm != null ? String(existing.hip_cm) : '',
      chest_cm: existing.chest_cm != null ? String(existing.chest_cm) : '',
      upper_arm_cm: existing.upper_arm_cm != null ? String(existing.upper_arm_cm) : '',
      thigh_cm: existing.thigh_cm != null ? String(existing.thigh_cm) : '',
      calf_cm: existing.calf_cm != null ? String(existing.calf_cm) : '',
      resting_hr: existing.resting_hr != null ? String(existing.resting_hr) : '',
      bp_systolic: existing.bp_systolic != null ? String(existing.bp_systolic) : '',
      bp_diastolic: existing.bp_diastolic != null ? String(existing.bp_diastolic) : '',
      notes: existing.notes ?? '',
    } : { measured_at: today },
  })

  async function onSubmit(data: MeasurementForm) {
    const payload: BodyMeasurementCreateRequest = {
      measured_at: data.measured_at,
      weight_kg: n(data.weight_kg),
      body_fat_pct: n(data.body_fat_pct),
      lean_mass_kg: n(data.lean_mass_kg),
      bf_method: (data.bf_method as BfMethod) ?? null,
      waist_cm: n(data.waist_cm),
      hip_cm: n(data.hip_cm),
      chest_cm: n(data.chest_cm),
      upper_arm_cm: n(data.upper_arm_cm),
      thigh_cm: n(data.thigh_cm),
      calf_cm: n(data.calf_cm),
      resting_hr: ni(data.resting_hr),
      bp_systolic: ni(data.bp_systolic),
      bp_diastolic: ni(data.bp_diastolic),
      notes: data.notes || null,
    }
    if (existing) {
      await update.mutateAsync({ id: existing.id, payload })
    } else {
      await create.mutateAsync(payload)
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => { if (!v) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? h.editMeasurement : h.addMeasurement}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <FieldRow label={`${h.measuredAt} *`}>
            <Input type="date" {...register('measured_at')} className="h-9" required />
          </FieldRow>

          {/* Body composition */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h.sectionComposition}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 items-end">
              <FieldRow label={h.weightKg}>
                <Input type="number" min={20} max={300} step={0.1} placeholder="80" {...register('weight_kg')} className="h-9" />
              </FieldRow>
              <FieldRow label={h.bodyFatPct}>
                <Input type="number" min={3} max={60} step={0.1} placeholder="15" {...register('body_fat_pct')} className="h-9" />
              </FieldRow>
              <FieldRow label={h.leanMassKg}>
                <Input type="number" min={20} max={200} step={0.1} placeholder="68" {...register('lean_mass_kg')} className="h-9" />
              </FieldRow>
            </div>
            <div className="mt-3">
              <FieldRow label={h.bfMethod}>
                <Controller name="bf_method" control={control} render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={(v: string) => field.onChange(v || undefined)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="–" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dexa">{h.bfDexa}</SelectItem>
                      <SelectItem value="skinfold">{h.bfSkinfold}</SelectItem>
                      <SelectItem value="bioimpedance">{h.bfBioimpedance}</SelectItem>
                      <SelectItem value="navy_formula">{h.bfNavy}</SelectItem>
                      <SelectItem value="visual">{h.bfVisual}</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </FieldRow>
            </div>
          </div>

          {/* Circumferences */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h.sectionCircumferences}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 items-end">
              <FieldRow label={h.waistCm}>
                <Input type="number" min={40} max={200} step={0.5} placeholder="–" {...register('waist_cm')} className="h-9" />
              </FieldRow>
              <FieldRow label={h.hipCm}>
                <Input type="number" min={40} max={200} step={0.5} placeholder="–" {...register('hip_cm')} className="h-9" />
              </FieldRow>
              <FieldRow label={h.chestCm}>
                <Input type="number" min={40} max={200} step={0.5} placeholder="–" {...register('chest_cm')} className="h-9" />
              </FieldRow>
              <FieldRow label={h.upperArmCm}>
                <Input type="number" min={10} max={100} step={0.5} placeholder="–" {...register('upper_arm_cm')} className="h-9" />
              </FieldRow>
              <FieldRow label={h.thighCm}>
                <Input type="number" min={20} max={150} step={0.5} placeholder="–" {...register('thigh_cm')} className="h-9" />
              </FieldRow>
              <FieldRow label={h.calfCm}>
                <Input type="number" min={20} max={100} step={0.5} placeholder="–" {...register('calf_cm')} className="h-9" />
              </FieldRow>
            </div>
          </div>

          {/* Vitals */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h.sectionVitals}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 items-end">
              <FieldRow label={h.restingHr}>
                <Input type="number" min={30} max={200} step={1} placeholder="60" {...register('resting_hr')} className="h-9" />
              </FieldRow>
              <FieldRow label={h.bpSystolic}>
                <Input type="number" min={60} max={250} step={1} placeholder="120" {...register('bp_systolic')} className="h-9" />
              </FieldRow>
              <FieldRow label={h.bpDiastolic}>
                <Input type="number" min={40} max={150} step={1} placeholder="80" {...register('bp_diastolic')} className="h-9" />
              </FieldRow>
            </div>
          </div>

          <FieldRow label={h.notes}>
            <Textarea {...register('notes')} placeholder="e.g. Post-bulk DEXA scan" rows={2} className="resize-none" />
          </FieldRow>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>{t.common.cancel}</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
              {t.common.save}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Measurement card ──────────────────────────────────────────────────────────

function MeasurementCard({ m, onEdit, onDelete }: { m: BodyMeasurement; onEdit: () => void; onDelete: () => void }) {
  const { t } = useI18n()
  const h = t.health

  const stats: [string, string][] = []
  if (m.weight_kg != null) stats.push([h.weightKg, `${m.weight_kg} kg`])
  if (m.body_fat_pct != null) stats.push([h.bodyFatPct, `${m.body_fat_pct}%`])
  if (m.lean_mass_kg != null) stats.push([h.leanMassKg, `${m.lean_mass_kg} kg`])
  if (m.waist_cm != null) stats.push([h.waistCm, `${m.waist_cm} cm`])
  if (m.hip_cm != null) stats.push([h.hipCm, `${m.hip_cm} cm`])
  if (m.chest_cm != null) stats.push([h.chestCm, `${m.chest_cm} cm`])
  if (m.upper_arm_cm != null) stats.push([h.upperArmCm, `${m.upper_arm_cm} cm`])
  if (m.thigh_cm != null) stats.push([h.thighCm, `${m.thigh_cm} cm`])
  if (m.calf_cm != null) stats.push([h.calfCm, `${m.calf_cm} cm`])
  if (m.resting_hr != null) stats.push([h.restingHr, `${m.resting_hr} bpm`])
  if (m.bp_systolic != null && m.bp_diastolic != null) stats.push(['BP', `${m.bp_systolic}/${m.bp_diastolic}`])

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-start justify-between">
        <p className="font-semibold">{m.measured_at}</p>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
            aria-label={t.common.edit}
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive/10 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
            aria-label={t.common.delete}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {stats.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
          {stats.map(([label, val]) => (
            <div key={label}>
              <dt className="text-[11px] text-muted-foreground">{label}</dt>
              <dd className="font-mono text-sm font-medium tabular-nums">{val}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">–</p>
      )}

      {m.notes && (
        <p className={cn('mt-2 text-xs text-muted-foreground', stats.length > 0 && 'border-t border-border pt-2')}>
          {m.notes}
        </p>
      )}
    </div>
  )
}

// ── Measurements section ──────────────────────────────────────────────────────

function MeasurementsSection({ athleteId }: { athleteId?: string | null }) {
  const { t } = useI18n()
  const h = t.health
  const { data: measurements, isLoading } = useMeasurements(athleteId)
  const deleteMut = useDeleteMeasurement(athleteId)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<BodyMeasurement | undefined>()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function openCreate() { setEditing(undefined); setDialogOpen(true) }
  function openEdit(m: BodyMeasurement) { setEditing(m); setDialogOpen(true) }
  function closeDialog() { setDialogOpen(false); setEditing(undefined) }

  async function confirmDelete() {
    if (!deletingId) return
    await deleteMut.mutateAsync(deletingId)
    setDeletingId(null)
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">{h.measurements}</h2>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 size-4" aria-hidden />
          {h.addMeasurement}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : !measurements?.length ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-semibold">{h.noMeasurements}</p>
          <p className="text-sm text-muted-foreground">{h.noMeasurementsDesc}</p>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 size-4" aria-hidden />
            {h.addMeasurement}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {measurements.map(m => (
            <MeasurementCard
              key={m.id}
              m={m}
              onEdit={() => openEdit(m)}
              onDelete={() => setDeletingId(m.id)}
            />
          ))}
        </div>
      )}

      <MeasurementDialog open={dialogOpen} onClose={closeDialog} existing={editing} athleteId={athleteId} />

      <AlertDialog open={!!deletingId} onOpenChange={(open: boolean) => { if (!open) setDeletingId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.common.delete}</AlertDialogTitle>
            <AlertDialogDescription>{h.deleteConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Athlete selector (trainer view) ──────────────────────────────────────────

function AthleteSelector({
  selected,
  onChange,
}: {
  selected: string | null
  onChange: (id: string | null) => void
}) {
  const { t } = useI18n()
  const h = t.health
  const { data: athletes, isLoading } = useOrgAthletes()

  if (isLoading) return <Skeleton className="h-9 w-full max-w-xs" />

  if (!athletes?.length) {
    return (
      <p className="text-sm text-muted-foreground">{h.noAthletes}</p>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm text-muted-foreground">{h.selectAthlete}</Label>
      <Select value={selected ?? ''} onValueChange={(v) => onChange(v || null)}>
        <SelectTrigger className="h-9 w-full max-w-xs">
          <SelectValue placeholder={h.selectAthlete} />
        </SelectTrigger>
        <SelectContent>
          {athletes.map((a: User) => (
            <SelectItem key={a.id} value={a.id}>{a.email}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HealthPage() {
  const { t } = useI18n()
  const role = useRole()
  const isTrainer = role === 'trainer' || role === 'gym_admin'
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null)

  const athleteId = isTrainer ? selectedAthleteId : null
  const showContent = !isTrainer || selectedAthleteId !== null

  return (
    <div className="p-4 pb-24 sm:p-6 lg:pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t.health.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.health.subtitle}</p>
      </div>

      {isTrainer && (
        <div className="mb-6">
          <AthleteSelector selected={selectedAthleteId} onChange={setSelectedAthleteId} />
        </div>
      )}

      {showContent ? (
        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">{t.health.profile}</TabsTrigger>
            <TabsTrigger value="measurements">{t.health.measurements}</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileSection athleteId={athleteId} />
          </TabsContent>

          <TabsContent value="measurements">
            <MeasurementsSection athleteId={athleteId} />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">
          <p className="font-semibold text-muted-foreground">{t.health.selectAthlete}</p>
        </div>
      )}
    </div>
  )
}
