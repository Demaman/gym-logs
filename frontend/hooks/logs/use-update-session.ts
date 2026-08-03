'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UpdateSessionRequest } from '@/types/api'
import { updateSession } from '@/lib/api/logs'

export function useUpdateSession(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateSessionRequest) => updateSession(sessionId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['logs', 'session', sessionId] })
      qc.invalidateQueries({ queryKey: ['logs', 'active'] })
    },
  })
}
