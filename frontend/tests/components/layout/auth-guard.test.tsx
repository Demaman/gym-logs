import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthGuard } from '@/components/layout/auth-guard'
import { useAuthStore } from '@/lib/auth/store'
import type { User } from '@/types/api'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

vi.mock('@/lib/api/client', () => ({
  api: { post: vi.fn() },
}))

vi.mock('@/lib/api/auth', () => ({
  me: vi.fn(),
}))

vi.mock('@/lib/auth/token', () => ({
  isTokenExpired: vi.fn().mockReturnValue(false),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_USER: User = {
  id: '1',
  email: 'athlete@test.com',
  role: 'athlete',
  organization_id: null,
  created_at: '',
}

async function getApi() {
  return (await import('@/lib/api/client')).api
}
async function getMe() {
  return (await import('@/lib/api/auth')).me
}
async function getIsTokenExpired() {
  return (await import('@/lib/auth/token')).isTokenExpired
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    useAuthStore.setState({ user: null, accessToken: null })
  })

  it('renders children immediately when user is authenticated with a valid token', async () => {
    const { isTokenExpired } = await import('@/lib/auth/token')
    vi.mocked(isTokenExpired).mockReturnValue(false)

    useAuthStore.setState({ user: MOCK_USER, accessToken: 'valid-token' })

    render(<AuthGuard><span>protected</span></AuthGuard>)
    await waitFor(() => expect(screen.getByText('protected')).toBeInTheDocument())
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('redirects to /login when no user and no refresh token', async () => {
    render(<AuthGuard><span>protected</span></AuthGuard>)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'))
    expect(screen.queryByText('protected')).not.toBeInTheDocument()
  })

  it('shows a spinner while refreshing', async () => {
    sessionStorage.setItem('refresh_token', 'rt-abc')
    const api = await getApi()
    // Keep the refresh pending indefinitely
    vi.mocked(api.post).mockReturnValue(new Promise(() => {}))

    render(<AuthGuard><span>protected</span></AuthGuard>)
    expect(screen.getByLabelText('Loading…')).toBeInTheDocument()
  })

  it('renders children after a successful token refresh', async () => {
    sessionStorage.setItem('refresh_token', 'rt-abc')
    const api = await getApi()
    const me = await getMe()

    vi.mocked(api.post).mockResolvedValue({
      data: { access_token: 'new-at', refresh_token: 'new-rt' },
    })
    vi.mocked(me).mockResolvedValue(MOCK_USER)

    render(<AuthGuard><span>protected</span></AuthGuard>)
    await waitFor(() => expect(screen.getByText('protected')).toBeInTheDocument())
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('stores the new access token and user in the auth store after refresh', async () => {
    sessionStorage.setItem('refresh_token', 'rt-abc')
    const api = await getApi()
    const me = await getMe()

    vi.mocked(api.post).mockResolvedValue({
      data: { access_token: 'new-at', refresh_token: 'new-rt' },
    })
    vi.mocked(me).mockResolvedValue(MOCK_USER)

    render(<AuthGuard><span>protected</span></AuthGuard>)
    await waitFor(() => {
      expect(useAuthStore.getState().accessToken).toBe('new-at')
      expect(useAuthStore.getState().user).toEqual(MOCK_USER)
    })
  })

  it('redirects to /login when refresh fails', async () => {
    sessionStorage.setItem('refresh_token', 'rt-expired')
    const api = await getApi()
    vi.mocked(api.post).mockRejectedValue(new Error('401'))

    render(<AuthGuard><span>protected</span></AuthGuard>)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'))
    expect(screen.queryByText('protected')).not.toBeInTheDocument()
  })

  it('removes stale refresh token from sessionStorage when refresh fails', async () => {
    sessionStorage.setItem('refresh_token', 'rt-expired')
    const api = await getApi()
    vi.mocked(api.post).mockRejectedValue(new Error('401'))

    render(<AuthGuard><span>protected</span></AuthGuard>)
    await waitFor(() => expect(sessionStorage.getItem('refresh_token')).toBeNull())
  })

  it('triggers refresh when user exists but token is expired', async () => {
    const { isTokenExpired } = await import('@/lib/auth/token')
    vi.mocked(isTokenExpired).mockReturnValue(true)

    sessionStorage.setItem('refresh_token', 'rt-abc')
    useAuthStore.setState({ user: MOCK_USER, accessToken: 'expired-token' })

    const api = await getApi()
    const me = await getMe()
    vi.mocked(api.post).mockResolvedValue({
      data: { access_token: 'fresh-at', refresh_token: 'fresh-rt' },
    })
    vi.mocked(me).mockResolvedValue(MOCK_USER)

    render(<AuthGuard><span>protected</span></AuthGuard>)
    await waitFor(() => expect(screen.getByText('protected')).toBeInTheDocument())
    expect(vi.mocked(api.post)).toHaveBeenCalledWith(
      '/api/v1/identity/auth/refresh',
      { refresh_token: 'rt-abc' },
    )
  })
})
