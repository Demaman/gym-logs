'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MuscleGroup, Equipment, CreateExerciseRequest, UpdateExerciseRequest } from '@/types/api'
import { createExercise, searchExercises, updateExercise, uploadExerciseVideo } from '@/lib/api/training'

const EXERCISES_KEY = ['training', 'exercises'] as const

export function useExerciseSearch(
  params: {
    query?: string
    muscle_group?: MuscleGroup
    equipment?: Equipment
    limit?: number
  } = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: [...EXERCISES_KEY, params],
    queryFn: () => searchExercises(params),
    staleTime: 60_000,
    enabled: options.enabled ?? true,
  })
}

export function useCreateExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateExerciseRequest) => createExercise(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXERCISES_KEY }),
  })
}

export function useUpdateExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateExerciseRequest }) =>
      updateExercise(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXERCISES_KEY }),
  })
}

export function useUploadExerciseVideo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      uploadExerciseVideo(id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXERCISES_KEY }),
  })
}
