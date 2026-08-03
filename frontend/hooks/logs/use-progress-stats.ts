'use client'

import { useQuery } from '@tanstack/react-query'
import { getProgressStats } from '@/lib/api/logs'

export function useProgressStats() {
  return useQuery({
    queryKey: ['logs', 'progress', 'stats'],
    queryFn: getProgressStats,
    staleTime: 60_000,
  })
}
