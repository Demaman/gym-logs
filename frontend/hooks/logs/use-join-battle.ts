'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { joinBattle } from '@/lib/api/logs'
import type { CreateSessionRequest } from '@/types/api'

export function useJoinBattle(code: string) {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (payload: CreateSessionRequest) => joinBattle(code, payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['logs', 'active'] })
      router.push(`/logs/${data.session.id}`)
    },
  })
}
