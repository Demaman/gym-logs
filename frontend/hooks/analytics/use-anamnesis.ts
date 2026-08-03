'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getProfile, updateProfile,
  listMeasurements, createMeasurement, updateMeasurement, deleteMeasurement,
  getAthleteProfileFor, updateAthleteProfileFor,
  listMeasurementsFor, createMeasurementFor, updateMeasurementFor, deleteMeasurementFor,
} from '@/lib/api/analytics'
import type { AthleteProfileUpdateRequest, BodyMeasurementCreateRequest } from '@/types/api'

function profileKey(athleteId?: string | null) {
  return athleteId ? ['analytics', 'athletes', athleteId, 'profile'] : ['analytics', 'profile']
}
function measurementsKey(athleteId?: string | null) {
  return athleteId
    ? ['analytics', 'athletes', athleteId, 'measurements']
    : ['analytics', 'measurements']
}

export function useAthleteProfile(athleteId?: string | null) {
  return useQuery({
    queryKey: profileKey(athleteId),
    queryFn: () => (athleteId ? getAthleteProfileFor(athleteId) : getProfile()),
  })
}

export function useUpdateProfile(athleteId?: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AthleteProfileUpdateRequest) =>
      athleteId ? updateAthleteProfileFor(athleteId, payload) : updateProfile(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKey(athleteId) }),
  })
}

export function useMeasurements(athleteId?: string | null) {
  return useQuery({
    queryKey: measurementsKey(athleteId),
    queryFn: () => (athleteId ? listMeasurementsFor(athleteId) : listMeasurements()),
  })
}

export function useCreateMeasurement(athleteId?: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: BodyMeasurementCreateRequest) =>
      athleteId ? createMeasurementFor(athleteId, payload) : createMeasurement(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: measurementsKey(athleteId) }),
  })
}

export function useUpdateMeasurement(athleteId?: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<BodyMeasurementCreateRequest> }) =>
      athleteId ? updateMeasurementFor(athleteId, id, payload) : updateMeasurement(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: measurementsKey(athleteId) }),
  })
}

export function useDeleteMeasurement(athleteId?: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      athleteId ? deleteMeasurementFor(athleteId, id) : deleteMeasurement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: measurementsKey(athleteId) }),
  })
}
