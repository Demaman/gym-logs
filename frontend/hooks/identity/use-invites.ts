import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { acceptInvite, declineInvite, deleteInvite, getMyInvites, inviteMember, listInvites } from '@/lib/api/identity'
import { useRole } from '@/hooks/use-role'
import type { InviteRequest } from '@/types/api'

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
  return useMutation({
    mutationFn: (id: string) => acceptInvite(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['identity', 'invites', 'mine'] })
      qc.invalidateQueries({ queryKey: ['identity', 'memberships'] })
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
