'use client'

import { useQuery } from '@tanstack/react-query'
import { getWeeklyVolume } from '@/lib/api/logs'

export function useWeeklyVolume(weeks = 12) {
  return useQuery({
    queryKey: ['logs', 'progress', 'weekly-volume', { weeks }],
    queryFn: () => getWeeklyVolume(weeks),
    staleTime: 60_000,
  })
}
