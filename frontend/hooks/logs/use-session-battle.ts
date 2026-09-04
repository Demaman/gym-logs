'use client'

import { useQuery } from '@tanstack/react-query'
import { getSessionBattle } from '@/lib/api/logs'

export function useSessionBattle(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['logs', 'session-battle', sessionId],
    queryFn: () => getSessionBattle(sessionId!),
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data || data.status === 'active') return 20_000
      return false
    },
  })
}
