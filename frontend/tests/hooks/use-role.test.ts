import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRole } from '@/hooks/use-role'
import { useAuthStore } from '@/lib/auth/store'
import type { User } from '@/types/api'

function mockUser(role: User['role']): User {
  return { id: '1', email: `${role}@test.com`, role, organization_id: null, created_at: '' }
}

describe('useRole', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: null })
  })

  it('returns null when no user is authenticated', () => {
    const { result } = renderHook(() => useRole())
    expect(result.current).toBeNull()
  })

  it('returns "athlete" for an athlete user', () => {
    useAuthStore.setState({ user: mockUser('athlete') })
    const { result } = renderHook(() => useRole())
    expect(result.current).toBe('athlete')
  })

  it('returns "trainer" for a trainer user', () => {
    useAuthStore.setState({ user: mockUser('trainer') })
    const { result } = renderHook(() => useRole())
    expect(result.current).toBe('trainer')
  })

  it('returns "gym_admin" for a gym admin user', () => {
    useAuthStore.setState({ user: mockUser('gym_admin') })
    const { result } = renderHook(() => useRole())
    expect(result.current).toBe('gym_admin')
  })

  it('updates reactively when the user changes', () => {
    useAuthStore.setState({ user: mockUser('athlete') })
    const { result, rerender } = renderHook(() => useRole())
    expect(result.current).toBe('athlete')

    useAuthStore.setState({ user: mockUser('trainer') })
    rerender()
    expect(result.current).toBe('trainer')
  })
})
