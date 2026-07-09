import type {
  Exercise, CreateExerciseRequest,
  Program, MuscleGroup, Equipment,
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
}): Promise<Program> {
  const { data } = await api.post<Program>('/api/v1/training/programs', payload)
  return data
}
