'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { LogSetRequest, UpdateSetRequest } from '@/types/api'
import { addSet, updateSet, deleteSet } from '@/lib/api/logs'

export function useAddSet(sessionId: string, exerciseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: LogSetRequest) => addSet(sessionId, exerciseId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['logs', 'active'] })
      qc.invalidateQueries({ queryKey: ['logs', 'session', sessionId] })
    },
  })
}

export function useUpdateSet(sessionId: string, exerciseId: string, setId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateSetRequest) => updateSet(sessionId, exerciseId, setId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['logs', 'active'] })
      qc.invalidateQueries({ queryKey: ['logs', 'session', sessionId] })
    },
  })
}

export function useDeleteSet(sessionId: string, exerciseId: string, setId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => deleteSet(sessionId, exerciseId, setId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['logs', 'active'] })
    },
  })
}
