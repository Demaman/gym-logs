import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useLogout } from '@/hooks/use-logout'
import { useAuthStore } from '@/lib/auth/store'
import type { User } from '@/types/api'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

vi.mock('@/lib/api/auth', () => ({
  logout: vi.fn().mockResolvedValue(undefined),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const MOCK_USER: User = {
  id: '1',
  email: 'athlete@test.com',
  role: 'athlete',
  organization_id: null,
  created_at: '',
}

function seedAuthState() {
  sessionStorage.setItem('refresh_token', 'rt-abc123')
  useAuthStore.setState({ accessToken: 'at-xyz', user: MOCK_USER })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useLogout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    useAuthStore.setState({ accessToken: null, user: null })
    seedAuthState()
  })

  it('calls the logout API with the stored refresh token', async () => {
    const { logout } = await import('@/lib/api/auth')
    const { result } = renderHook(() => useLogout(), { wrapper })

    await act(async () => { result.current.mutate() })
    await waitFor(() => expect(logout).toHaveBeenCalledWith('rt-abc123'))
  })

  it('clears accessToken from the auth store', async () => {
    const { result } = renderHook(() => useLogout(), { wrapper })

    await act(async () => { result.current.mutate() })
    await waitFor(() => expect(useAuthStore.getState().accessToken).toBeNull())
  })

  it('clears user from the auth store', async () => {
    const { result } = renderHook(() => useLogout(), { wrapper })

    await act(async () => { result.current.mutate() })
    await waitFor(() => expect(useAuthStore.getState().user).toBeNull())
  })

  it('removes refresh_token from sessionStorage', async () => {
    const { result } = renderHook(() => useLogout(), { wrapper })

    await act(async () => { result.current.mutate() })
    await waitFor(() => expect(sessionStorage.getItem('refresh_token')).toBeNull())
  })

  it('redirects to /login', async () => {
    const { result } = renderHook(() => useLogout(), { wrapper })

    await act(async () => { result.current.mutate() })
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'))
  })

  it('still clears local state even when the API call throws', async () => {
    const { logout } = await import('@/lib/api/auth')
    vi.mocked(logout).mockRejectedValueOnce(new Error('network error'))

    const { result } = renderHook(() => useLogout(), { wrapper })
    await act(async () => { result.current.mutate() })

    await waitFor(() => {
      expect(useAuthStore.getState().accessToken).toBeNull()
      expect(useAuthStore.getState().user).toBeNull()
      expect(sessionStorage.getItem('refresh_token')).toBeNull()
      expect(mockReplace).toHaveBeenCalledWith('/login')
    })
  })

  it('does not call the API when no refresh token is stored', async () => {
    sessionStorage.removeItem('refresh_token')
    const { logout } = await import('@/lib/api/auth')

    const { result } = renderHook(() => useLogout(), { wrapper })
    await act(async () => { result.current.mutate() })

    await waitFor(() => expect(logout).not.toHaveBeenCalled())
    expect(mockReplace).toHaveBeenCalledWith('/login')
  })
})
