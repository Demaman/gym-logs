'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AddExerciseRequest } from '@/types/api'
import { addExercise, deleteExercise } from '@/lib/api/logs'

export function useAddExercise(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AddExerciseRequest) => addExercise(sessionId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['logs', 'active'] })
      qc.invalidateQueries({ queryKey: ['logs', 'session', sessionId] })
    },
  })
}

export function useDeleteExercise(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (exerciseId: string) => deleteExercise(sessionId, exerciseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['logs', 'active'] })
      qc.invalidateQueries({ queryKey: ['logs', 'session', sessionId] })
    },
  })
}
