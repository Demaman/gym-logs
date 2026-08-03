import type {
  AthleteProfile, AthleteProfileUpdateRequest,
  BodyMeasurement, BodyMeasurementCreateRequest,
} from '@/types/api'
import { api } from './client'

export async function getProfile(): Promise<AthleteProfile> {
  const { data } = await api.get<AthleteProfile>('/api/v1/analytics/profile')
  return data
}

export async function updateProfile(payload: AthleteProfileUpdateRequest): Promise<AthleteProfile> {
  const { data } = await api.put<AthleteProfile>('/api/v1/analytics/profile', payload)
  return data
}

export async function listMeasurements(params?: { limit?: number; offset?: number }): Promise<BodyMeasurement[]> {
  const { data } = await api.get<BodyMeasurement[]>('/api/v1/analytics/measurements', { params })
  return data
}

export async function createMeasurement(payload: BodyMeasurementCreateRequest): Promise<BodyMeasurement> {
  const { data } = await api.post<BodyMeasurement>('/api/v1/analytics/measurements', payload)
  return data
}

export async function updateMeasurement(
  id: string,
  payload: Partial<BodyMeasurementCreateRequest>,
): Promise<BodyMeasurement> {
  const { data } = await api.patch<BodyMeasurement>(`/api/v1/analytics/measurements/${id}`, payload)
  return data
}

export async function deleteMeasurement(id: string): Promise<void> {
  await api.delete(`/api/v1/analytics/measurements/${id}`)
}

// ── Trainer-scoped (on behalf of an athlete) ──────────────────────────────────

export async function getAthleteProfileFor(athleteId: string): Promise<AthleteProfile> {
  const { data } = await api.get<AthleteProfile>(`/api/v1/analytics/athletes/${athleteId}/profile`)
  return data
}

export async function updateAthleteProfileFor(
  athleteId: string,
  payload: AthleteProfileUpdateRequest,
): Promise<AthleteProfile> {
  const { data } = await api.put<AthleteProfile>(`/api/v1/analytics/athletes/${athleteId}/profile`, payload)
  return data
}

export async function listMeasurementsFor(
  athleteId: string,
  params?: { limit?: number; offset?: number },
): Promise<BodyMeasurement[]> {
  const { data } = await api.get<BodyMeasurement[]>(
    `/api/v1/analytics/athletes/${athleteId}/measurements`, { params }
  )
  return data
}

export async function createMeasurementFor(
  athleteId: string,
  payload: BodyMeasurementCreateRequest,
): Promise<BodyMeasurement> {
  const { data } = await api.post<BodyMeasurement>(
    `/api/v1/analytics/athletes/${athleteId}/measurements`, payload
  )
  return data
}

export async function updateMeasurementFor(
  athleteId: string,
  id: string,
  payload: Partial<BodyMeasurementCreateRequest>,
): Promise<BodyMeasurement> {
  const { data } = await api.patch<BodyMeasurement>(
    `/api/v1/analytics/athletes/${athleteId}/measurements/${id}`, payload
  )
  return data
}

export async function deleteMeasurementFor(athleteId: string, id: string): Promise<void> {
  await api.delete(`/api/v1/analytics/athletes/${athleteId}/measurements/${id}`)
}
