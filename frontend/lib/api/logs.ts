import type {
  WorkoutSession, LoggedExercise, LoggedSet,
  CreateSessionRequest, UpdateSessionRequest, FinishSessionRequest,
  AddExerciseRequest, LogSetRequest, UpdateSetRequest,
  ExerciseLastSession,
  ProgressStats, WeeklyVolumeSeries, ExerciseHistorySeries,
  AttendanceSummary,
  SessionBattle, BattleState, JoinBattleResponse,
} from '@/types/api'
import { api } from './client'

export async function startSession(payload: CreateSessionRequest): Promise<WorkoutSession> {
  const { data } = await api.post<WorkoutSession>('/api/v1/logs/sessions', payload)
  return data
}

export async function getActiveSession(): Promise<WorkoutSession | null> {
  const resp = await api.get('/api/v1/logs/sessions/active', {
    validateStatus: (s) => s === 200 || s === 204,
  })
  return resp.status === 204 ? null : (resp.data as WorkoutSession)
}

export async function getSession(id: string): Promise<WorkoutSession> {
  const { data } = await api.get<WorkoutSession>(`/api/v1/logs/sessions/${id}`)
  return data
}

export async function listSessions(params?: {
  limit?: number
  offset?: number
}): Promise<WorkoutSession[]> {
  const { data } = await api.get<WorkoutSession[]>('/api/v1/logs/sessions', { params })
  return data
}

export async function finishSession(
  id: string,
  payload: FinishSessionRequest = {},
): Promise<WorkoutSession> {
  const { data } = await api.patch<WorkoutSession>(
    `/api/v1/logs/sessions/${id}/finish`,
    payload,
  )
  return data
}

export async function updateSession(
  id: string,
  payload: UpdateSessionRequest,
): Promise<WorkoutSession> {
  const { data } = await api.patch<WorkoutSession>(`/api/v1/logs/sessions/${id}`, payload)
  return data
}

export async function deleteSession(id: string): Promise<void> {
  await api.delete(`/api/v1/logs/sessions/${id}`)
}

export async function addExercise(
  sessionId: string,
  payload: AddExerciseRequest,
): Promise<LoggedExercise> {
  const { data } = await api.post<LoggedExercise>(
    `/api/v1/logs/sessions/${sessionId}/exercises`,
    payload,
  )
  return data
}

export async function deleteExercise(sessionId: string, exerciseId: string): Promise<void> {
  await api.delete(`/api/v1/logs/sessions/${sessionId}/exercises/${exerciseId}`)
}

export async function addSet(
  sessionId: string,
  exerciseId: string,
  payload: LogSetRequest,
): Promise<LoggedSet> {
  const { data } = await api.post<LoggedSet>(
    `/api/v1/logs/sessions/${sessionId}/exercises/${exerciseId}/sets`,
    payload,
  )
  return data
}

export async function updateSet(
  sessionId: string,
  exerciseId: string,
  setId: string,
  payload: UpdateSetRequest,
): Promise<LoggedSet> {
  const { data } = await api.patch<LoggedSet>(
    `/api/v1/logs/sessions/${sessionId}/exercises/${exerciseId}/sets/${setId}`,
    payload,
  )
  return data
}

export async function getExerciseLastSession(
  catalogExerciseId: string,
): Promise<ExerciseLastSession | null> {
  const resp = await api.get(
    `/api/v1/logs/exercises/catalog/${catalogExerciseId}/last-session`,
    { validateStatus: (s) => s === 200 || s === 204 },
  )
  return resp.status === 204 ? null : (resp.data as ExerciseLastSession)
}

export async function deleteSet(
  sessionId: string,
  exerciseId: string,
  setId: string,
): Promise<void> {
  await api.delete(
    `/api/v1/logs/sessions/${sessionId}/exercises/${exerciseId}/sets/${setId}`,
  )
}

export async function getProgressStats(): Promise<ProgressStats> {
  const { data } = await api.get<ProgressStats>('/api/v1/logs/sessions/stats')
  return data
}

export async function getWeeklyVolume(weeks = 12): Promise<WeeklyVolumeSeries> {
  const { data } = await api.get<WeeklyVolumeSeries>(
    '/api/v1/logs/sessions/volume-over-time',
    { params: { weeks } },
  )
  return data
}

export async function getExerciseHistory(
  catalogExerciseId: string,
): Promise<ExerciseHistorySeries> {
  const { data } = await api.get<ExerciseHistorySeries>(
    `/api/v1/logs/exercises/catalog/${catalogExerciseId}/history`,
  )
  return data
}

// ── Trainer-scoped athlete log endpoints ─────────────────────────────────────

export async function startAthleteSession(
  athleteId: string,
  payload: CreateSessionRequest,
): Promise<WorkoutSession> {
  const { data } = await api.post<WorkoutSession>(
    `/api/v1/logs/athletes/${athleteId}/sessions`,
    payload,
  )
  return data
}

export async function getAthleteActiveSession(
  athleteId: string,
): Promise<WorkoutSession | null> {
  const resp = await api.get(
    `/api/v1/logs/athletes/${athleteId}/sessions/active`,
    { validateStatus: (s) => s === 200 || s === 204 },
  )
  return resp.status === 204 ? null : (resp.data as WorkoutSession)
}

export async function finishAthleteSession(
  athleteId: string,
  sessionId: string,
  payload: FinishSessionRequest = {},
): Promise<WorkoutSession> {
  const { data } = await api.patch<WorkoutSession>(
    `/api/v1/logs/athletes/${athleteId}/sessions/${sessionId}/finish`,
    payload,
  )
  return data
}

export async function getAthleteSessionHistory(
  athleteId: string,
  params?: { limit?: number; offset?: number },
): Promise<WorkoutSession[]> {
  const { data } = await api.get<WorkoutSession[]>(
    `/api/v1/logs/athletes/${athleteId}/sessions`,
    { params },
  )
  return data
}

export async function getAthleteProgressStats(athleteId: string): Promise<ProgressStats> {
  const { data } = await api.get<ProgressStats>(
    `/api/v1/logs/athletes/${athleteId}/sessions/stats`,
  )
  return data
}

export async function getAthleteWeeklyVolume(
  athleteId: string,
  weeks = 26,
): Promise<WeeklyVolumeSeries> {
  const { data } = await api.get<WeeklyVolumeSeries>(
    `/api/v1/logs/athletes/${athleteId}/sessions/volume-over-time`,
    { params: { weeks } },
  )
  return data
}

export async function getAthleteExerciseHistory(
  athleteId: string,
  catalogExerciseId: string,
): Promise<ExerciseHistorySeries> {
  const { data } = await api.get<ExerciseHistorySeries>(
    `/api/v1/logs/athletes/${athleteId}/exercises/${catalogExerciseId}/history`,
  )
  return data
}

// ── Attendance endpoints ───────────────────────────────────────────────────────

export async function getAttendanceSummary(): Promise<AttendanceSummary> {
  const { data } = await api.get<AttendanceSummary>('/api/v1/logs/attendance/summary')
  return data
}

export async function manualCheckin(userId: string): Promise<void> {
  await api.post('/api/v1/logs/attendance/checkin', { user_id: userId })
}

// ── Battle endpoints ──────────────────────────────────────────────────────────

export async function startBattle(sessionId: string): Promise<SessionBattle> {
  const { data } = await api.post<SessionBattle>(`/api/v1/logs/sessions/${sessionId}/battle`)
  return data
}

export async function joinBattle(
  code: string,
  payload: CreateSessionRequest,
): Promise<JoinBattleResponse> {
  const { data } = await api.post<JoinBattleResponse>(`/api/v1/logs/battles/${code}/join`, payload)
  return data
}

export async function getBattle(battleId: string): Promise<BattleState> {
  const { data } = await api.get<BattleState>(`/api/v1/logs/battles/${battleId}`)
  return data
}

export async function getSessionBattle(sessionId: string): Promise<BattleState | null> {
  const resp = await api.get(`/api/v1/logs/sessions/${sessionId}/battle`, {
    validateStatus: (s) => s === 200 || s === 204,
  })
  return resp.status === 204 ? null : (resp.data as BattleState)
}

export async function listBattles(): Promise<BattleState[]> {
  const { data } = await api.get<BattleState[]>('/api/v1/logs/battles')
  return data
}
