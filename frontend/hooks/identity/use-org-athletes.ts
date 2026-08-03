'use client'
import { useQuery } from '@tanstack/react-query'
import { listOrgAthletes } from '@/lib/api/identity'

export function useOrgAthletes() {
  return useQuery({
    queryKey: ['identity', 'athletes'],
    queryFn: listOrgAthletes,
  })
}
