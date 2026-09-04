'use client'

import { CalendarCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAttendanceSummary } from '@/hooks/logs/use-attendance'
import { useI18n } from '@/providers/i18n-provider'
import { Skeleton } from '@/components/ui/skeleton'
import type { HeatmapPoint } from '@/types/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null, never: string) {
  if (!iso) return never
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => i)
// isodow: 1=Mon … 7=Sun — map index 0–6 directly
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

function Heatmap({
  points,
  dayLabels,
}: {
  points: HeatmapPoint[]
  dayLabels: Record<typeof DAY_KEYS[number], string>
}) {
  const max = Math.max(1, ...points.map((p) => p.count))

  const lookup = new Map<string, number>()
  for (const p of points) lookup.set(`${p.day_of_week}:${p.hour}`, p.count)

  function intensity(count: number) {
    if (count === 0) return 0
    return Math.ceil((count / max) * 4)
  }

  const CELL_BG = [
    'bg-zinc-100 dark:bg-zinc-800',
    'bg-violet-100 dark:bg-violet-900/40',
    'bg-violet-200 dark:bg-violet-800/60',
    'bg-violet-400 dark:bg-violet-600',
    'bg-violet-600 dark:bg-violet-400',
  ]

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Hour labels */}
        <div className="flex gap-0.5 pl-10 mb-0.5">
          {HOURS.map((h) => (
            <div key={h} className="w-[calc((100%-2.5rem)/24)] text-center text-[9px] text-muted-foreground">
              {h % 4 === 0 ? `${h}h` : ''}
            </div>
          ))}
        </div>

        {/* Rows: one per day (Mon=isodow 1, Sun=isodow 7) */}
        {DAY_KEYS.map((key, dayIdx) => {
          const dow = dayIdx + 1
          return (
            <div key={key} className="flex items-center gap-0.5 mb-0.5">
              <div className="w-9 shrink-0 text-right pr-1.5 text-[10px] text-muted-foreground">
                {dayLabels[key]}
              </div>
              {HOURS.map((h) => {
                const count = lookup.get(`${dow}:${h}`) ?? 0
                const level = intensity(count)
                return (
                  <div
                    key={h}
                    title={count > 0 ? `${count} check-ins` : undefined}
                    className={cn(
                      'h-4 flex-1 rounded-[2px] transition-colors',
                      CELL_BG[level],
                    )}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function AttendanceSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const { t } = useI18n()
  const { data, isLoading } = useAttendanceSummary()

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <CalendarCheck className="size-5 text-primary" aria-hidden />
          <h1 className="text-2xl font-bold">{t.attendance.title}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t.attendance.subtitle}</p>
      </div>

      {isLoading ? (
        <AttendanceSkeleton />
      ) : !data ? null : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label={t.attendance.todayHeadcount}    value={data.today_count}      />
            <StatCard label={t.attendance.yesterdayHeadcount} value={data.yesterday_count} />
            <StatCard label={t.attendance.thisWeek}          value={data.this_week_count}  />
            <StatCard label={t.attendance.lastWeek}          value={data.last_week_count}  />
          </div>

          {/* Heatmap */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold">{t.attendance.heatmapTitle}</h2>
            {data.heatmap.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.attendance.noData}</p>
            ) : (
              <Heatmap points={data.heatmap} dayLabels={t.attendance.days as Record<typeof DAY_KEYS[number], string>} />
            )}
          </div>

          {/* Per-member table */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">{t.attendance.perMemberTitle}</h2>
            </div>
            {data.per_member.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                {t.attendance.noData}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-3">{t.attendance.memberEmail}</th>
                      <th className="px-5 py-3 text-right">{t.attendance.sessionsCount}</th>
                      <th className="px-5 py-3 text-right">{t.attendance.lastCheckin}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.per_member.map((m) => (
                      <tr
                        key={m.user_id}
                        className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors"
                      >
                        <td className="px-5 py-3 font-medium">{m.email}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{m.sessions_count}</td>
                        <td className="px-5 py-3 text-right text-muted-foreground">
                          {formatDate(m.last_checkin, t.attendance.never)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
