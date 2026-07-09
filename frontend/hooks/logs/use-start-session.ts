'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateSessionRequest } from '@/types/api'
import { startSession } from '@/lib/api/logs'

export function useStartSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSessionRequest) => startSession(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['logs', 'active'] })
    },
  })
}
