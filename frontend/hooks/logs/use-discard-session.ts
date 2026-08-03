'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteSession } from '@/lib/api/logs'

export function useDiscardSession(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => deleteSession(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['logs', 'active'] })
      qc.removeQueries({ queryKey: ['logs', 'session', sessionId] })
    },
  })
}
