import type {
  Exercise, CreateExerciseRequest, UpdateExerciseRequest,
  Program, ProgramDay, ProgramExercise, PrescribedSet,
  MuscleGroup, Equipment,
  UpdateProgramRequest,
  CreateProgramDayRequest, UpdateProgramDayRequest,
  AddExerciseToDayRequest, AddPrescribedSetRequest,
  UpdateProgramExerciseRequest,
} from '@/types/api'
import { api } from './client'

export async function searchExercises(params: {
  query?: string
  muscle_group?: MuscleGroup
  equipment?: Equipment
  limit?: number
  offset?: number
}): Promise<Exercise[]> {
  const { data } = await api.get<Exercise[]>('/api/v1/training/exercises', { params })
  return data
}

export async function createExercise(payload: CreateExerciseRequest): Promise<Exercise> {
  const { data } = await api.post<Exercise>('/api/v1/training/exercises', payload)
  return data
}

export async function updateExercise(id: string, payload: UpdateExerciseRequest): Promise<Exercise> {
  const { data } = await api.put<Exercise>(`/api/v1/training/exercises/${id}`, payload)
  return data
}

export async function uploadExerciseVideo(id: string, file: File): Promise<Exercise> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<Exercise>(`/api/v1/training/exercises/${id}/video`, form)
  return data
}

export async function listPrograms(): Promise<Program[]> {
  const { data } = await api.get<Program[]>('/api/v1/training/programs')
  return data
}

export async function getProgram(id: string): Promise<Program> {
  const { data } = await api.get<Program>(`/api/v1/training/programs/${id}`)
  return data
}

export async function createProgram(payload: {
  name: string
  description?: string
  mode?: 'on_the_fly' | 'program_driven'
  athlete_id?: string
}): Promise<Program> {
  const { data } = await api.post<Program>('/api/v1/training/programs', payload)
  return data
}

export async function assignProgramToAthletes(
  programId: string,
  athleteIds: string[],
): Promise<Program[]> {
  const { data } = await api.post<Program[]>(
    `/api/v1/training/programs/${programId}/assign`,
    { athlete_ids: athleteIds },
  )
  return data
}

export async function updateProgram(
  id: string,
  payload: UpdateProgramRequest,
): Promise<Program> {
  const { data } = await api.put<Program>(`/api/v1/training/programs/${id}`, payload)
  return data
}

export async function deleteProgram(id: string): Promise<void> {
  await api.delete(`/api/v1/training/programs/${id}`)
}

export async function addDay(
  programId: string,
  payload: CreateProgramDayRequest,
): Promise<ProgramDay> {
  const { data } = await api.post<ProgramDay>(
    `/api/v1/training/programs/${programId}/days`,
    payload,
  )
  return data
}

export async function updateDay(
  dayId: string,
  payload: UpdateProgramDayRequest,
): Promise<ProgramDay> {
  const { data } = await api.put<ProgramDay>(`/api/v1/training/days/${dayId}`, payload)
  return data
}

export async function deleteDay(dayId: string): Promise<void> {
  await api.delete(`/api/v1/training/days/${dayId}`)
}

export async function addExerciseToDay(
  dayId: string,
  payload: AddExerciseToDayRequest,
): Promise<ProgramExercise> {
  const { data } = await api.post<ProgramExercise>(
    `/api/v1/training/days/${dayId}/exercises`,
    payload,
  )
  return data
}

export async function updateProgramExercise(
  exId: string,
  payload: UpdateProgramExerciseRequest,
): Promise<ProgramExercise> {
  const { data } = await api.patch<ProgramExercise>(
    `/api/v1/training/program-exercises/${exId}`,
    payload,
  )
  return data
}

export async function deleteProgramExercise(exId: string): Promise<void> {
  await api.delete(`/api/v1/training/exercises-in-day/${exId}`)
}

export async function addPrescribedSet(
  exId: string,
  payload: AddPrescribedSetRequest,
): Promise<PrescribedSet> {
  const { data } = await api.post<PrescribedSet>(
    `/api/v1/training/program-exercises/${exId}/sets`,
    payload,
  )
  return data
}

export async function replacePrescribedSets(
  exId: string,
  payload: AddPrescribedSetRequest[],
): Promise<PrescribedSet[]> {
  const { data } = await api.put<PrescribedSet[]>(
    `/api/v1/training/program-exercises/${exId}/sets`,
    payload,
  )
  return data
}

export async function deletePrescribedSet(
  exId: string,
  setId: string,
): Promise<void> {
  await api.delete(`/api/v1/training/program-exercises/${exId}/sets/${setId}`)
}
