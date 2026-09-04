'use client'
import { useQuery } from '@tanstack/react-query'
import { getActiveSession } from '@/lib/api/logs'

export function useActiveSession() {
  return useQuery({
    queryKey: ['logs', 'active'],
    queryFn: getActiveSession,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
    refetchInterval: 15_000,
  })
}
