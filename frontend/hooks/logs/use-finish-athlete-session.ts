'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { FinishSessionRequest } from '@/types/api'
import { finishAthleteSession } from '@/lib/api/logs'

export function useFinishAthleteSession(athleteId: string, sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: FinishSessionRequest) =>
      finishAthleteSession(athleteId, sessionId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['logs', 'athlete-active', athleteId] })
      qc.invalidateQueries({ queryKey: ['logs', 'history'] })
    },
  })
}
