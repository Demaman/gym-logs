'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { startBattle } from '@/lib/api/logs'

export function useStartBattle(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => startBattle(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['logs', 'session-battle', sessionId] })
    },
  })
}
