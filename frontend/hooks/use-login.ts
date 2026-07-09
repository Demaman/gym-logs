'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { type AxiosError } from 'axios'
import { login as loginApi, me as meApi } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/auth/store'
import type { ApiError } from '@/types/api'

interface LoginInput {
  email: string
  password: string
}

export function useLogin() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  return useMutation<void, AxiosError<ApiError>, LoginInput>({
    mutationFn: async ({ email, password }) => {
      const tokens = await loginApi(email, password)
      localStorage.setItem('refresh_token', tokens.refresh_token)
      const user = await meApi(tokens.access_token)
      setAuth(tokens.access_token, user)
    },
    onSuccess: () => {
      router.push('/logs')
    },
  })
}
