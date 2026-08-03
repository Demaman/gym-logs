import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { acceptInvite, declineInvite, deleteInvite, getMe, getMyInvites, inviteMember, listInvites } from '@/lib/api/identity'
import { useAuthStore } from '@/lib/auth/store'
import { useRole } from '@/hooks/use-role'
import type { InviteRequest } from '@/types/api'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export function useInvites() {
  return useQuery({
    queryKey: ['identity', 'invites'],
    queryFn: listInvites,
  })
}

export function useInviteMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: InviteRequest) => inviteMember(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['identity', 'invites'] })
      qc.invalidateQueries({ queryKey: ['identity', 'memberships'] })
    },
  })
}

export function useDeleteInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInvite(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['identity', 'invites'] })
    },
  })
}

export function useMyInvites() {
  const role = useRole()
  return useQuery({
    queryKey: ['identity', 'invites', 'mine'],
    queryFn: getMyInvites,
    enabled: role === 'athlete',
  })
}

export function useAcceptInvite() {
  const qc = useQueryClient()
  const setAuth = useAuthStore((s) => s.setAuth)

  return useMutation({
    mutationFn: (id: string) => acceptInvite(id),
    onSuccess: async () => {
      // Rotate tokens so the new JWT carries the updated organization_id claim.
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
          // Stale token is acceptable — next natural expiry will refresh.
        }
      }
      qc.invalidateQueries({ queryKey: ['identity', 'invites', 'mine'] })
      qc.invalidateQueries({ queryKey: ['identity', 'memberships'] })
      qc.invalidateQueries({ queryKey: ['identity', 'organization'] })
    },
  })
}

export function useDeclineInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => declineInvite(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['identity', 'invites', 'mine'] })
    },
  })
}
