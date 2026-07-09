import { useAuthStore } from '@/lib/auth/store'
import type { User } from '@/types/api'

export type Role = User['role']

export function useRole(): Role | null {
  return useAuthStore((s) => s.user?.role ?? null)
}
