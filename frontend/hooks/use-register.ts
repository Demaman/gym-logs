'use client'

import { useMutation } from '@tanstack/react-query'
import { register as registerApi } from '@/lib/api/auth'
import type { RegisterRequest } from '@/types/api'

export function useRegister() {
  return useMutation({
    mutationFn: (payload: RegisterRequest) => registerApi(payload),
  })
}
