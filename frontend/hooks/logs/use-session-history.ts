'use client'
import { useQuery } from '@tanstack/react-query'
import { listSessions } from '@/lib/api/logs'

export function useSessionHistory(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['logs', 'history', params],
    queryFn: () => listSessions(params),
    staleTime: 30_000,
  })
}
