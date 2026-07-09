'use client'
import { useQuery } from '@tanstack/react-query'
import { getSession } from '@/lib/api/logs'

export function useSession(id: string) {
  return useQuery({
    queryKey: ['logs', 'session', id],
    queryFn: () => getSession(id),
    enabled: !!id,
  })
}
