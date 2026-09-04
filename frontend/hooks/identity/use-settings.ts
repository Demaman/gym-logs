'use client'

import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  changePassword,
  getMe,
  getMyOrganization,
  updateMe,
  updateMyOrganization,
} from '@/lib/api/identity'
import { useAuthStore } from '@/lib/auth/store'
import type { OrganizationUpdateRequest, PasswordChangeRequest, UserUpdateRequest } from '@/types/api'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

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

export function useRefreshStatus() {
  const qc = useQueryClient()
  const setAuth = useAuthStore((s) => s.setAuth)

  return useMutation({
    mutationFn: async () => {
      const stored = typeof window !== 'undefined' ? sessionStorage.getItem('refresh_token') : null
      if (!stored) throw new Error('No refresh token')
      const { data: tokens } = await axios.post(
        `${BASE_URL}/api/v1/identity/auth/refresh`,
        { refresh_token: stored },
      )
      sessionStorage.setItem('refresh_token', tokens.refresh_token)
      return tokens
    },
    onSuccess: async (tokens) => {
      const freshUser = await getMe()
      setAuth(tokens.access_token, freshUser)
      qc.invalidateQueries({ queryKey: ['identity', 'organization'] })
      qc.invalidateQueries({ queryKey: ['identity', 'memberships'] })
    },
  })
}
