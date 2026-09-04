'use client'

import { useQuery } from '@tanstack/react-query'
import { listBattles } from '@/lib/api/logs'

export function useBattleHistory() {
  return useQuery({
    queryKey: ['logs', 'battles'],
    queryFn: listBattles,
  })
}
