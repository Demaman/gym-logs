'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listPrograms, createProgram, getProgram } from '@/lib/api/training'

export function usePrograms() {
  return useQuery({
    queryKey: ['training', 'programs'],
    queryFn: listPrograms,
    staleTime: 60_000,
  })
}

export function useProgram(id: string) {
  return useQuery({
    queryKey: ['training', 'program', id],
    queryFn: () => getProgram(id),
    enabled: !!id,
  })
}

export function useCreateProgram() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createProgram,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training', 'programs'] })
    },
  })
}
