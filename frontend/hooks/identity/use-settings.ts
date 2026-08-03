'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  changePassword,
  getMyOrganization,
  updateMe,
  updateMyOrganization,
} from '@/lib/api/identity'
import type { OrganizationUpdateRequest, PasswordChangeRequest, UserUpdateRequest } from '@/types/api'

export function useMyOrganization() {
  return useQuery({
    queryKey: ['identity', 'organization', 'current'],
    queryFn: getMyOrganization,
    retry: false,
  })
}

export function useUpdateMe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UserUpdateRequest) => updateMe(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['identity', 'me'] })
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: PasswordChangeRequest) => changePassword(payload),
  })
}

export function useUpdateMyOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: OrganizationUpdateRequest) => updateMyOrganization(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['identity', 'organization', 'current'] })
    },
  })
}
