import { useQuery } from '@tanstack/react-query'
import { getMemberHealth } from '@/lib/api/identity'

export function useMemberHealth() {
  return useQuery({
    queryKey: ['identity', 'member-health'],
    queryFn: getMemberHealth,
  })
}
