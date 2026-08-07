'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { generateProgram } from '@/lib/api/ai'
import type { GenerateProgramRequest } from '@/types/api'

export function useGenerateProgram() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (req: GenerateProgramRequest) => generateProgram(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training', 'programs'] })
    },
  })
}
