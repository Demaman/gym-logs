import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteMembership,
  getMe,
  getMyMemberships,
  getMyTrainer,
  getOrgMemberships,
  leaveOrganization,
  listOrgTrainers,
} from '@/lib/api/identity'
import { useAuthStore } from '@/lib/auth/store'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export function useMyMemberships() {
  return useQuery({
    queryKey: ['identity', 'memberships', 'mine'],
    queryFn: getMyMemberships,
  })
}

export function useOrgMemberships() {
  return useQuery({
    queryKey: ['identity', 'memberships', 'org'],
    queryFn: getOrgMemberships,
  })
}

export function useOrgTrainers() {
  return useQuery({
    queryKey: ['identity', 'trainers'],
    queryFn: listOrgTrainers,
  })
}

export function useMyTrainer() {
  return useQuery({
    queryKey: ['identity', 'memberships', 'my-trainer'],
    queryFn: getMyTrainer,
  })
}

export function useDeleteMembership() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteMembership(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['identity', 'memberships'] })
    },
  })
}

export function useLeaveOrganization() {
  const qc = useQueryClient()
  const setAuth = useAuthStore((s) => s.setAuth)

  return useMutation({
    mutationFn: leaveOrganization,
    onSuccess: async () => {
      const storedRefresh = sessionStorage.getItem('refresh_token')
      if (storedRefresh) {
        try {
          const { data: tokens } = await axios.post(
            `${BASE_URL}/api/v1/identity/auth/refresh`,
            { refresh_token: storedRefresh },
          )
          sessionStorage.setItem('refresh_token', tokens.refresh_token)
          const freshUser = await getMe()
          setAuth(tokens.access_token, freshUser)
        } catch {
          // Stale token acceptable — next natural expiry will refresh.
        }
      }
      qc.invalidateQueries({ queryKey: ['identity', 'memberships'] })
      qc.invalidateQueries({ queryKey: ['identity', 'organization'] })
    },
  })
}
