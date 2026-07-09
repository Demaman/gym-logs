'use client'

import type { Role } from '@/hooks/use-role'
import { useRole } from '@/hooks/use-role'

interface CanProps {
  roles: Role[]
  children: React.ReactNode
}

export function useCanAccess(roles: Role[]): boolean {
  const role = useRole()
  if (!role) return false
  return roles.includes(role)
}

export function Can({ roles, children }: CanProps) {
  const allowed = useCanAccess(roles)
  if (!allowed) return null
  return <>{children}</>
}
