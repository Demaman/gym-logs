import type {
  WorkoutSession, LoggedExercise, LoggedSet,
  CreateSessionRequest, FinishSessionRequest,
  AddExerciseRequest, LogSetRequest, UpdateSetRequest,
  ExerciseLastSession,
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
