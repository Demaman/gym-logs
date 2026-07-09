'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { logout as logoutApi } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/auth/store'

export function useLogout() {
  const router = useRouter()
  const clearAuth = useAuthStore((s) => s.clearAuth)

  return useMutation({
    mutationFn: async () => {
      const refreshToken =
        typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null
      if (refreshToken) {
        // best-effort: revoke on the server so the refresh token can't be reused
        await logoutApi(refreshToken).catch(() => undefined)
      }
    },
    onSettled: () => {
      if (typeof window !== 'undefined') localStorage.removeItem('refresh_token')
      clearAuth()
      router.replace('/login')
    },
  })
}
