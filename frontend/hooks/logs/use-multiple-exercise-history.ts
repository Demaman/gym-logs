'use client'
import { useQueries } from '@tanstack/react-query'
import { getExerciseHistory } from '@/lib/api/logs'

export function useMultipleExerciseHistory(catalogExerciseIds: string[]) {
  return useQueries({
    queries: catalogExerciseIds.map((id) => ({
      queryKey: ['logs', 'progress', 'exercise', id],
      queryFn: () => getExerciseHistory(id),
      enabled: catalogExerciseIds.length > 0,
      staleTime: 60_000,
    })),
  })
}
