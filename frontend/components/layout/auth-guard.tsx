'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/lib/auth/store'
import { api } from '@/lib/api/client'
import { me } from '@/lib/api/auth'
import { isTokenExpired } from '@/lib/auth/token'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const { user, setAuth } = useAuthStore()
  const [status, setStatus] = useState<'checking' | 'refreshing' | 'ready' | 'redirecting'>(
    user ? 'ready' : 'checking',
  )

  useEffect(() => {
    const { accessToken } = useAuthStore.getState()

    // Valid session — token present and not expiring soon
    if (user && accessToken && !isTokenExpired(accessToken)) {
      setStatus('ready')
      return
    }

    // Token expired or missing — attempt silent refresh
    const refreshToken = sessionStorage.getItem('refresh_token')
    if (!refreshToken) {
      setStatus('redirecting')
      router.replace('/login')
      return
    }

    setStatus('refreshing')

    api
      .post<{ access_token: string; refresh_token: string }>(
        '/api/v1/identity/auth/refresh',
        { refresh_token: refreshToken },
      )
      .then(async ({ data }) => {
        const newAccessToken = data.access_token
        if (data.refresh_token) {
          sessionStorage.setItem('refresh_token', data.refresh_token)
        }
        const userData = await me(newAccessToken)
        setAuth(newAccessToken, userData)
        setStatus('ready')
      })
      .catch(() => {
        sessionStorage.removeItem('refresh_token')
        setStatus('redirecting')
        router.replace('/login')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'checking' || status === 'refreshing') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" aria-label="Loading…" />
      </div>
    )
  }

  if (status === 'redirecting') {
    return null
  }

  return <>{children}</>
}
