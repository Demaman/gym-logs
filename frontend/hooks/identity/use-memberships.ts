import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteMembership,
  getMyMemberships,
  getMyTrainer,
  getOrgMemberships,
  listOrgTrainers,
} from '@/lib/api/identity'

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
