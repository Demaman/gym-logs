'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listPrograms, createProgram, getProgram,
  assignProgramToAthletes, updateProgram, deleteProgram,
  addDay, updateDay, deleteDay,
  addExerciseToDay, updateProgramExercise, deleteProgramExercise,
  addPrescribedSet, deletePrescribedSet,
} from '@/lib/api/training'
import type {
  UpdateProgramRequest,
  CreateProgramDayRequest, UpdateProgramDayRequest,
  AddExerciseToDayRequest, AddPrescribedSetRequest,
  UpdateProgramExerciseRequest,
} from '@/types/api'

const PROGRAMS_KEY = ['training', 'programs'] as const

export function usePrograms() {
  return useQuery({
    queryKey: PROGRAMS_KEY,
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
      qc.invalidateQueries({ queryKey: PROGRAMS_KEY })
    },
  })
}

export function useAssignProgram() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ programId, athleteIds }: { programId: string; athleteIds: string[] }) =>
      assignProgramToAthletes(programId, athleteIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROGRAMS_KEY })
    },
  })
}

export function useUpdateProgram() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProgramRequest }) =>
      updateProgram(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROGRAMS_KEY })
    },
  })
}

export function useDeleteProgram() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteProgram(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROGRAMS_KEY })
    },
  })
}

export function useAddDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ programId, payload }: { programId: string; payload: CreateProgramDayRequest }) =>
      addDay(programId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROGRAMS_KEY })
    },
  })
}

export function useUpdateDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ dayId, payload }: { dayId: string; payload: UpdateProgramDayRequest }) =>
      updateDay(dayId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROGRAMS_KEY })
    },
  })
}

export function useDeleteDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dayId: string) => deleteDay(dayId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROGRAMS_KEY })
    },
  })
}

export function useAddExerciseToDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ dayId, payload }: { dayId: string; payload: AddExerciseToDayRequest }) =>
      addExerciseToDay(dayId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROGRAMS_KEY })
    },
  })
}

export function useUpdateProgramExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ exId, payload }: { exId: string; payload: UpdateProgramExerciseRequest }) =>
      updateProgramExercise(exId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROGRAMS_KEY })
    },
  })
}

export function useDeleteProgramExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (exId: string) => deleteProgramExercise(exId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROGRAMS_KEY })
    },
  })
}

export function useAddPrescribedSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ exId, payload }: { exId: string; payload: AddPrescribedSetRequest }) =>
      addPrescribedSet(exId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROGRAMS_KEY })
    },
  })
}

export function useDeletePrescribedSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ exId, setId }: { exId: string; setId: string }) =>
      deletePrescribedSet(exId, setId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROGRAMS_KEY })
    },
  })
}
