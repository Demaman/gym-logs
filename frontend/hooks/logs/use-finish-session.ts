'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { FinishSessionRequest } from '@/types/api'
import { finishSession } from '@/lib/api/logs'

export function useFinishSession(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: FinishSessionRequest) => finishSession(sessionId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['logs', 'active'] })
      qc.invalidateQueries({ queryKey: ['logs', 'history'] })
    },
  })
}
