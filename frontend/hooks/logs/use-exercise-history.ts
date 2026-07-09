'use client'
import { useQuery } from '@tanstack/react-query'
import { getExerciseLastSession } from '@/lib/api/logs'

export function useExerciseLastSession(catalogExerciseId: string | null) {
  return useQuery({
    queryKey: ['logs', 'exercise-history', catalogExerciseId],
    queryFn: () => getExerciseLastSession(catalogExerciseId!),
    enabled: !!catalogExerciseId,
    staleTime: 30_000,
  })
}
