'use client'
import { useQuery } from '@tanstack/react-query'
import { getAthleteActiveSession } from '@/lib/api/logs'

export function useAthleteActiveSession(athleteId: string | undefined) {
  return useQuery({
    queryKey: ['logs', 'athlete-active', athleteId],
    queryFn: () => getAthleteActiveSession(athleteId!),
    enabled: !!athleteId,
    refetchInterval: 30_000,
  })
}
