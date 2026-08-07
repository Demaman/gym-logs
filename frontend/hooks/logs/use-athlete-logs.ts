'use client'

import { useQueries, useQuery } from '@tanstack/react-query'
import {
  getAthleteExerciseHistory,
  getAthleteProgressStats,
  getAthleteSessionHistory,
  getAthleteWeeklyVolume,
} from '@/lib/api/logs'

export function useAthleteSessionHistory(
  athleteId: string | undefined,
  params?: { limit?: number; offset?: number },
) {
  return useQuery({
    queryKey: ['logs', 'athlete', athleteId, 'sessions', params],
    queryFn: () => getAthleteSessionHistory(athleteId!, params),
    enabled: !!athleteId,
  })
}

export function useAthleteProgressStats(athleteId: string | undefined) {
  return useQuery({
    queryKey: ['logs', 'athlete', athleteId, 'stats'],
    queryFn: () => getAthleteProgressStats(athleteId!),
    enabled: !!athleteId,
  })
}

export function useAthleteWeeklyVolume(athleteId: string | undefined, weeks = 26) {
  return useQuery({
    queryKey: ['logs', 'athlete', athleteId, 'volume', weeks],
    queryFn: () => getAthleteWeeklyVolume(athleteId!, weeks),
    enabled: !!athleteId,
  })
}

export function useAthleteExerciseHistory(
  athleteId: string | undefined,
  catalogExerciseId: string | undefined,
) {
  return useQuery({
    queryKey: ['logs', 'athlete', athleteId, 'exercise-history', catalogExerciseId],
    queryFn: () => getAthleteExerciseHistory(athleteId!, catalogExerciseId!),
    enabled: !!athleteId && !!catalogExerciseId,
  })
}

export function useAthleteMultipleExerciseHistory(
  athleteId: string | undefined,
  exerciseIds: string[],
) {
  return useQueries({
    queries: exerciseIds.map((id) => ({
      queryKey: ['logs', 'athlete', athleteId, 'exercise-history', id],
      queryFn: () => getAthleteExerciseHistory(athleteId!, id),
      enabled: !!athleteId,
    })),
  })
}
