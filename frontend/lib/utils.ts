import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { WeeklyVolumePoint } from '@/types/api'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Fill gaps in a sparse weekly volume series — always returns exactly `weeks`
 * points in ascending date order. Missing weeks get volume_kg: 0.
 * Matches PostgreSQL date_trunc('week', ...) which uses Monday as week start.
 */
export function fillWeeklyVolumeSeries(
  points: WeeklyVolumePoint[],
  weeks = 12,
): WeeklyVolumePoint[] {
  const map = new Map(points.map((p) => [p.week_start, p.volume_kg]))
  const result: WeeklyVolumePoint[] = []
  const now = new Date()
  const currentMonday = new Date(now)
  // ISO week: day 1 = Monday. ((day + 6) % 7) gives days since Monday.
  currentMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  currentMonday.setHours(0, 0, 0, 0)
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(currentMonday)
    d.setDate(currentMonday.getDate() - i * 7)
    const iso = d.toISOString().split('T')[0]
    result.push({ week_start: iso, volume_kg: map.get(iso) ?? 0 })
  }
  return result
}

/** Format an ISO date string to a short "Jun 14" label for chart X-axis ticks. */
export function formatWeekLabel(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
