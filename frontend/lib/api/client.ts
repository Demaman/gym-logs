import axios, { type AxiosError } from 'axios'
import { useAuthStore } from '@/lib/auth/store'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export const api = axios.create({ baseURL: BASE_URL })

// Inject access token on every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Token refresh + retry queue on 401
let isRefreshing = false
let queue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

function flushQueue(err: unknown, token: string | null) {
  queue.forEach(({ resolve, reject }) => (err ? reject(err) : resolve(token!)))
  queue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const req = error.config as typeof error.config & { _retry?: boolean }

    if (error.response?.status !== 401 || req?._retry) return Promise.reject(error)

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        queue.push({ resolve, reject })
      }).then((token) => {
        req!.headers!.Authorization = `Bearer ${token}`
        return api(req!)
      })
    }

    req!._retry = true
    isRefreshing = true

    const refreshToken =
      typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null

    if (!refreshToken) {
      useAuthStore.getState().clearAuth()
      if (typeof window !== 'undefined') window.location.href = '/login'
      return Promise.reject(error)
    }

    try {
      const { data } = await axios.post(`${BASE_URL}/api/v1/identity/auth/refresh`, {
        refresh_token: refreshToken,
      })
      const newToken: string = data.access_token
      useAuthStore.getState().setAuth(newToken, useAuthStore.getState().user!)
      localStorage.setItem('refresh_token', data.refresh_token)
      flushQueue(null, newToken)
      req!.headers!.Authorization = `Bearer ${newToken}`
      return api(req!)
    } catch (err) {
      flushQueue(err, null)
      useAuthStore.getState().clearAuth()
      localStorage.removeItem('refresh_token')
      if (typeof window !== 'undefined') window.location.href = '/login'
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  },
)
