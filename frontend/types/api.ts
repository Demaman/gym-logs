export interface User {
  id: string
  email: string
  role: 'athlete' | 'trainer' | 'gym_admin'
  organization_id: string | null
  created_at: string
}

export interface Organization {
  id: string
  name: string
  join_code: string | null
  cnpj: string | null
  phone: string | null
  contact_email: string | null
  address_street: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
  website: string | null
  created_at: string
}

export interface OrgLookup {
  id: string
  name: string
}

export interface OrganizationCreateRequest {
  name: string
  cnpj?: string | null
  phone?: string | null
  contact_email?: string | null
  address_street?: string | null
  address_city?: string | null
  address_state?: string | null
  address_zip?: string | null
  website?: string | null
}

export interface OrganizationUpdateRequest {
  name?: string | null
  cnpj?: string | null
  phone?: string | null
  contact_email?: string | null
  address_street?: string | null
  address_city?: string | null
  address_state?: string | null
  address_zip?: string | null
  website?: string | null
}

export interface UserUpdateRequest {
  email?: string
}

export interface PasswordChangeRequest {
  current_password: string
  new_password: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface RegisterRequest {
  email: string
  password: string
  role: 'athlete' | 'trainer' | 'gym_admin'
  organization_id?: string
  join_code?: string
}

export interface MembershipEnriched {
  id: string
  organization_id: string | null
  trainer_id: string
  trainer_email: string
  athlete_id: string
  athlete_email: string
  created_at: string
}

export interface Invite {
  id: string
  organization_id: string
  organization_name: string | null
  email: string
  role: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export interface InviteRequest {
  email: string
  role: string
  pre_filled_data?: Record<string, unknown> | null
}

export interface ApiError {
  detail: string
}

// ── Training types ────────────────────────────────────────────────────────────

export type SetType =
  | 'warm_up' | 'feeder' | 'working' | 'back_off' | 'top_set'
  | 'failure' | 'drop_set' | 'rest_pause' | 'cluster'
  | 'burnout' | 'technique' | 'deload'

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms'
  | 'core' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'full_body'

export type Equipment =
  | 'barbell' | 'dumbbell' | 'machine' | 'cable'
  | 'bodyweight' | 'kettlebell' | 'bands' | 'other'

export type MovementPattern =
  | 'push' | 'pull' | 'squat' | 'hinge' | 'carry' | 'rotation' | 'isolation'

export type DayTag =
  | 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full_body' | 'cardio' | 'custom'
  | 'chest' | 'back' | 'shoulders' | 'arms' | 'glutes' | 'core'

export type SessionMode = 'on_the_fly' | 'program_driven'

export interface Exercise {
  id: string
  organization_id: string | null
  name: string
  aliases: string[]
  muscle_group: MuscleGroup
  secondary_muscles: string[]
  equipment: Equipment
  movement_pattern: MovementPattern
  is_bilateral: boolean
  is_global: boolean
  notes: string | null
  created_at: string
}

export interface PrescribedSet {
  id: string
  program_exercise_id: string
  position: number
  set_type: SetType
  rep_min: number
  rep_max: number
  rpe_target: number | null
  rest_seconds: number | null
  weight_pct_1rm: number | null
  notes: string | null
}

export interface ProgramExercise {
  id: string
  program_day_id: string
  exercise_id: string
  position: number
  notes: string | null
  prescribed_sets: PrescribedSet[]
}

export interface ProgramDay {
  id: string
  program_id: string
  name: string
  position: number
  day_tag: DayTag
  exercises: ProgramExercise[]
}

export interface Program {
  id: string
  organization_id: string | null
  athlete_id: string | null
  name: string
  description: string | null
  mode: SessionMode
  is_active: boolean
  created_at: string
  days: ProgramDay[]
}

// ── Logs types ────────────────────────────────────────────────────────────────

export interface LoggedSet {
  id: string
  logged_exercise_id: string
  position: number
  set_type: SetType
  weight_kg: number
  reps: number
  rpe: number | null
  rir: number | null
  is_to_failure: boolean
  counts_volume: boolean
  tempo: string | null
  notes: string | null
  recorded_at: string
}

export interface PrescribedSetTarget {
  set_type: SetType
  rep_min: number
  rep_max: number
  rpe_target: number | null
  rest_seconds: number | null
}

export interface LoggedExercise {
  id: string
  session_id: string
  exercise_id: string | null
  exercise_name_free: string | null
  position: number
  notes: string | null
  logged_sets: LoggedSet[]
  prescribed_sets: PrescribedSetTarget[]
}

export interface ExerciseAverage {
  weight_kg: number | null
  reps: number | null
  rpe: number | null
  total_volume_kg: number
  sets_count: number
  volume_sets_count: number
}

export interface ExerciseLastSession {
  session_name: string
  session_date: string
  sets: LoggedSet[]
  average: ExerciseAverage
}

export interface SessionSummary {
  duration_seconds: number | null
  total_volume_kg: number
  working_sets_count: number
  sets_by_type: Record<string, number>
  exercises_count: number
}

export interface WorkoutSession {
  id: string
  organization_id: string | null
  athlete_id: string
  program_day_id: string | null
  name: string
  mode: SessionMode
  day_tag: DayTag | null
  started_at: string
  finished_at: string | null
  notes: string | null
  perceived_difficulty: number | null
  logged_exercises: LoggedExercise[]
  summary: SessionSummary | null
}

// ── Request types ─────────────────────────────────────────────────────────────

export interface CreateExerciseRequest {
  name: string
  aliases?: string[]
  muscle_group: MuscleGroup
  secondary_muscles?: string[]
  equipment: Equipment
  movement_pattern: MovementPattern
  is_bilateral?: boolean
  notes?: string
}

// ── Training request types ────────────────────────────────────────────────────

export interface UpdateProgramRequest {
  name?: string
  description?: string
  athlete_id?: string
}

export interface CreateProgramDayRequest {
  name: string
  position: number
  day_tag: DayTag
}

export interface UpdateProgramDayRequest {
  name?: string
  day_tag?: DayTag
  position?: number
}

export interface AddExerciseToDayRequest {
  exercise_id: string
  position: number
  notes?: string
}

export interface AddPrescribedSetRequest {
  position: number
  set_type?: SetType
  rep_min?: number
  rep_max?: number
  rpe_target?: number | null
  rest_seconds?: number | null
  weight_pct_1rm?: number | null
  notes?: string | null
}

// ── Log request types ─────────────────────────────────────────────────────────

export interface CreateSessionRequest {
  mode: SessionMode
  program_day_id?: string
  name?: string
  day_tag?: DayTag
}

export interface UpdateSessionRequest {
  name?: string
  day_tag?: DayTag
  program_day_id?: string | null
}

export interface FinishSessionRequest {
  notes?: string
  perceived_difficulty?: number
}

export interface AddExerciseRequest {
  exercise_id?: string
  exercise_name_free?: string
  notes?: string
}

export interface LogSetRequest {
  set_type?: SetType
  weight_kg: number
  reps: number
  rpe?: number
  rir?: number
  is_to_failure?: boolean
  counts_volume?: boolean
  tempo?: string
  notes?: string
}

export interface UpdateSetRequest extends Partial<LogSetRequest> {}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

// ── Analytics / Anamnesis types ───────────────────────────────────────────────

export type SexType = 'male' | 'female' | 'other'
export type DominantSide = 'left' | 'right'
export type CompetitionLevel = 'recreational' | 'amateur' | 'competitive' | 'elite'
export type GoalType = 'strength' | 'hypertrophy' | 'fat_loss' | 'endurance' | 'sport_performance' | 'general_fitness'
export type BfMethod = 'dexa' | 'skinfold' | 'bioimpedance' | 'navy_formula' | 'visual'

export interface AthleteProfile {
  id: string
  user_id: string
  organization_id: string | null
  date_of_birth: string | null
  sex: SexType | null
  dominant_side: DominantSide | null
  height_cm: number | null
  training_age_years: number | null
  training_frequency_available: number | null
  primary_sport: string | null
  competition_level: CompetitionLevel | null
  primary_goal: GoalType | null
  target_event_date: string | null
  parq_cleared: boolean
  injury_history: string | null
  surgeries: string | null
  chronic_conditions: string | null
  medications: string | null
  contraindications: string | null
  created_at: string
  updated_at: string
}

export interface BodyMeasurement {
  id: string
  user_id: string
  measured_at: string
  weight_kg: number | null
  body_fat_pct: number | null
  lean_mass_kg: number | null
  bf_method: BfMethod | null
  waist_cm: number | null
  hip_cm: number | null
  chest_cm: number | null
  upper_arm_cm: number | null
  thigh_cm: number | null
  calf_cm: number | null
  resting_hr: number | null
  bp_systolic: number | null
  bp_diastolic: number | null
  notes: string | null
  created_at: string
}

export interface AthleteProfileUpdateRequest {
  date_of_birth?: string | null
  sex?: SexType | null
  dominant_side?: DominantSide | null
  height_cm?: number | null
  training_age_years?: number | null
  training_frequency_available?: number | null
  primary_sport?: string | null
  competition_level?: CompetitionLevel | null
  primary_goal?: GoalType | null
  target_event_date?: string | null
  parq_cleared?: boolean | null
  injury_history?: string | null
  surgeries?: string | null
  chronic_conditions?: string | null
  medications?: string | null
  contraindications?: string | null
}

export interface BodyMeasurementCreateRequest {
  measured_at: string
  weight_kg?: number | null
  body_fat_pct?: number | null
  lean_mass_kg?: number | null
  bf_method?: BfMethod | null
  waist_cm?: number | null
  hip_cm?: number | null
  chest_cm?: number | null
  upper_arm_cm?: number | null
  thigh_cm?: number | null
  calf_cm?: number | null
  resting_hr?: number | null
  bp_systolic?: number | null
  bp_diastolic?: number | null
  notes?: string | null
}

// ── Progress / analytics types ────────────────────────────────────────────────

export interface ProgressStats {
  total_sessions: number
  total_volume_kg: number
  sessions_this_month: number
  avg_volume_per_session: number
}

export interface WeeklyVolumePoint {
  week_start: string
  volume_kg: number
}

export interface WeeklyVolumeSeries {
  points: WeeklyVolumePoint[]
}

export interface ExerciseHistoryPoint {
  session_date: string
  session_name: string
  best_weight_kg: number | null
  volume_kg: number
}

export interface ExerciseHistorySeries {
  exercise_name: string | null
  points: ExerciseHistoryPoint[]
}
