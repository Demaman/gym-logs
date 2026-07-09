import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { Can, useCanAccess } from '@/components/layout/can'
import { useAuthStore } from '@/lib/auth/store'
import type { User } from '@/types/api'

function setRole(role: User['role'] | null) {
  useAuthStore.setState({
    user: role
      ? { id: '1', email: `${role}@test.com`, role, organization_id: null, created_at: '' }
      : null,
  })
}

describe('Can', () => {
  beforeEach(() => setRole(null))

  it('renders children when the user role is in the allowed list', () => {
    setRole('trainer')
    render(<Can roles={['trainer']}><span>visible</span></Can>)
    expect(screen.getByText('visible')).toBeInTheDocument()
  })

  it('renders nothing when the user role is NOT in the allowed list', () => {
    setRole('athlete')
    render(<Can roles={['trainer', 'gym_admin']}><span>hidden</span></Can>)
    expect(screen.queryByText('hidden')).not.toBeInTheDocument()
  })

  it('renders nothing when the user is not authenticated', () => {
    setRole(null)
    render(<Can roles={['athlete', 'trainer', 'gym_admin']}><span>hidden</span></Can>)
    expect(screen.queryByText('hidden')).not.toBeInTheDocument()
  })

  it('accepts multiple allowed roles and renders for any matching role', () => {
    setRole('gym_admin')
    render(<Can roles={['trainer', 'gym_admin']}><span>visible</span></Can>)
    expect(screen.getByText('visible')).toBeInTheDocument()
  })

  it('renders nothing for gym_admin when only athlete is allowed', () => {
    setRole('gym_admin')
    render(<Can roles={['athlete']}><span>hidden</span></Can>)
    expect(screen.queryByText('hidden')).not.toBeInTheDocument()
  })
})

describe('useCanAccess', () => {
  beforeEach(() => setRole(null))

  it('returns true when the current role is in the list', () => {
    setRole('gym_admin')
    const { result } = renderHook(() => useCanAccess(['trainer', 'gym_admin']))
    expect(result.current).toBe(true)
  })

  it('returns false when the current role is NOT in the list', () => {
    setRole('athlete')
    const { result } = renderHook(() => useCanAccess(['trainer', 'gym_admin']))
    expect(result.current).toBe(false)
  })

  it('returns false when no user is authenticated', () => {
    setRole(null)
    const { result } = renderHook(() => useCanAccess(['athlete', 'trainer', 'gym_admin']))
    expect(result.current).toBe(false)
  })

  it('updates reactively when the role changes', () => {
    setRole('athlete')
    const { result, rerender } = renderHook(() => useCanAccess(['trainer']))
    expect(result.current).toBe(false)

    setRole('trainer')
    rerender()
    expect(result.current).toBe(true)
  })
})
