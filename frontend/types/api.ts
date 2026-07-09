export interface User {
  id: string
  email: string
  role: 'athlete' | 'trainer' | 'gym_admin'
  organization_id: string | null
  created_at: string
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

export interface LoggedExercise {
  id: string
  session_id: string
  exercise_id: string | null
  exercise_name_free: string | null
  position: number
  notes: string | null
  logged_sets: LoggedSet[]
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

export interface CreateSessionRequest {
  mode: SessionMode
  program_day_id?: string
  name?: string
  day_tag?: DayTag
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
