import { api } from './client'
import type { RegisterRequest, TokenResponse, User } from '@/types/api'

export async function login(email: string, password: string): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/api/v1/identity/auth/login', {
    email,
    password,
  })
  return data
}

export async function register(payload: RegisterRequest): Promise<User> {
  const { data } = await api.post<User>('/api/v1/identity/auth/register', payload)
  return data
}

export async function logout(refreshToken: string): Promise<void> {
  await api.post('/api/v1/identity/auth/logout', { refresh_token: refreshToken })
}

export async function me(token?: string): Promise<User> {
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined
  const { data } = await api.get<User>('/api/v1/identity/users/me', { headers })
  return data
}
