'use client'
import { useQuery } from '@tanstack/react-query'
import { getExerciseLastSession, getExerciseHistory } from '@/lib/api/logs'

export function useExerciseLastSession(catalogExerciseId: string | null) {
  return useQuery({
    queryKey: ['logs', 'exercise-history', catalogExerciseId],
    queryFn: () => getExerciseLastSession(catalogExerciseId!),
    enabled: !!catalogExerciseId,
    staleTime: 30_000,
  })
}

export function useExerciseHistory(catalogExerciseId: string | null) {
  return useQuery({
    queryKey: ['logs', 'progress', 'exercise', catalogExerciseId],
    queryFn: () => getExerciseHistory(catalogExerciseId!),
    enabled: !!catalogExerciseId,
    staleTime: 60_000,
  })
}
