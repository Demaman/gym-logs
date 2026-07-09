'use client'
import { useQuery } from '@tanstack/react-query'
import type { MuscleGroup, Equipment } from '@/types/api'
import { searchExercises } from '@/lib/api/training'

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
    queryKey: ['training', 'exercises', params],
    queryFn: () => searchExercises(params),
    staleTime: 60_000,
    enabled: options.enabled ?? true,
  })
}
