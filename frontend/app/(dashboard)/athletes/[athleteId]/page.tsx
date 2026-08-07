'use client'

import { useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, X, Search } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { WeeklyVolumeChart } from '@/components/charts/weekly-volume-chart'
import { ExerciseProgressionChart, seriesColor } from '@/components/charts/exercise-progression-chart'
import { useI18n } from '@/providers/i18n-provider'
import {
  useAthleteProgressStats,
  useAthleteWeeklyVolume,
  useAthleteSessionHistory,
} from '@/hooks/logs/use-athlete-logs'
import { useExerciseSearch } from '@/hooks/training/use-exercises'
import { useMyMemberships, useOrgMemberships } from '@/hooks/identity/use-memberships'
import { useRole } from '@/hooks/use-role'
import type { Exercise, WorkoutSession } from '@/types/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function emailInitials(email: string) {
  const local = email.split('@')[0]
  const parts = local.split(/[._-]/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
    .padEnd(1, local[0]?.toUpperCase() ?? '?')
}

function fmtVolume(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)
}

function fmtDuration(started: string, finished: string | null) {
  if (!finished) return '—'
  const secs = Math.round((new Date(finished).getTime() - new Date(started).getTime()) / 1000)
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmtDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === 'pt-BR' ? 'pt-BR' : 'en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold tabular-nums">
        {value}
        {unit && <span className="ml-1 text-base font-medium text-muted-foreground">{unit}</span>}
      </p>
    </div>
  )
}

// ── StatsRow ──────────────────────────────────────────────────────────────────

function StatsRow({ athleteId }: { athleteId: string }) {
  const { t } = useI18n()
  const a = t.analytics
  const { data: stats, isLoading } = useAthleteProgressStats(athleteId)

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label={a.totalSessions} value={String(stats?.total_sessions ?? 0)} />
      <StatCard label={a.totalVolume} value={fmtVolume(stats?.total_volume_kg ?? 0)} unit="kg" />
      <StatCard label={a.sessionsThisMonth} value={String(stats?.sessions_this_month ?? 0)} />
      <StatCard
        label={a.avgVolumePerSession}
        value={fmtVolume(stats?.avg_volume_per_session ?? 0)}
        unit="kg"
      />
    </div>
  )
}

// ── SessionRow ────────────────────────────────────────────────────────────────

function SessionRow({ session, locale }: { session: WorkoutSession; locale: string }) {
  const vol = session.summary?.total_volume_kg ?? 0
  const tag = session.day_tag?.replace(/_/g, ' ') ?? null

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{session.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {fmtDate(session.started_at, locale)}
          {tag && (
            <>
              {' · '}
              <span className="capitalize">{tag}</span>
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-4 text-right text-xs tabular-nums text-muted-foreground">
        <span>{fmtDuration(session.started_at, session.finished_at ?? null)}</span>
        {vol > 0 && <span>{fmtVolume(vol)} kg</span>}
      </div>
    </div>
  )
}

// ── RecentSessions ────────────────────────────────────────────────────────────

function RecentSessions({ athleteId }: { athleteId: string }) {
  const { t, locale } = useI18n()
  const { data: sessions, isLoading } = useAthleteSessionHistory(athleteId, { limit: 20 })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (!sessions?.length) {
    return (
      <div className="rounded-xl border border-border bg-card/50 px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">{t.athletes.noSessionsYet}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t.athletes.noSessionsDesc}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sessions.map((s) => (
        <SessionRow key={s.id} session={s} locale={locale} />
      ))}
    </div>
  )
}

// ── ExerciseSelector ──────────────────────────────────────────────────────────

function ExerciseSelector({
  selected,
  onAdd,
  onRemove,
}: {
  selected: Exercise[]
  onAdd: (ex: Exercise) => void
  onRemove: (id: string) => void
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { data: results = [], isLoading } = useExerciseSearch(
    query.trim().length >= 1 ? { query: query.trim(), limit: 8 } : undefined,
  )

  const selectedIds = new Set(selected.map((e) => e.id))

  return (
    <div className="space-y-4">
      {/* Selected pills */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((ex, i) => (
            <span
              key={ex.id}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{
                background: `${seriesColor(i)}20`,
                color: seriesColor(i),
                border: `1px solid ${seriesColor(i)}40`,
              }}
            >
              {ex.name}
              <button
                type="button"
                aria-label={`Remove ${ex.name}`}
                onClick={() => onRemove(ex.id)}
                className="rounded-full opacity-70 hover:opacity-100"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.analytics.searchExercises}
          className="pl-9"
        />
      </div>

      {/* Dropdown results */}
      {query.trim().length >= 1 && (
        <div className="rounded-xl border border-border bg-card shadow-md">
          {isLoading ? (
            <div className="space-y-1 p-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-lg" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">{t.logs.noExercisesYet}</p>
          ) : (
            <ul role="listbox">
              {results
                .filter((ex) => !selectedIds.has(ex.id))
                .slice(0, 6)
                .map((ex) => (
                  <li key={ex.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      className="w-full rounded-lg px-4 py-2.5 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        onAdd(ex)
                        setQuery('')
                        inputRef.current?.focus()
                      }}
                    >
                      <span className="font-medium">{ex.name}</span>
                      {ex.muscle_group && (
                        <span className="ml-2 text-xs text-muted-foreground capitalize">
                          {ex.muscle_group.replace(/_/g, ' ')}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AthleteDetailPage() {
  const params = useParams<{ athleteId: string }>()
  const athleteId = params.athleteId
  const { t } = useI18n()
  const role = useRole()

  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([])

  // Resolve athlete email from whichever membership list is available
  const { data: myMemberships } = useMyMemberships()
  const { data: orgMemberships } = useOrgMemberships()
  const memberships = role === 'gym_admin' ? (orgMemberships ?? []) : (myMemberships ?? [])
  const membership = memberships.find((m) => m.athlete_id === athleteId)
  const athleteEmail = membership?.athlete_email

  const handleAddExercise = (ex: Exercise) => {
    setSelectedExercises((prev) =>
      prev.find((e) => e.id === ex.id) ? prev : [...prev, ex].slice(0, 6),
    )
  }

  const handleRemoveExercise = (id: string) => {
    setSelectedExercises((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/athletes"
          className="flex items-center gap-1.5 rounded-lg p-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={t.athletes.backToClients}
        >
          <ArrowLeft className="size-4" aria-hidden />
          <span className="hidden sm:inline">{t.athletes.backToClients}</span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {athleteEmail ? emailInitials(athleteEmail) : '??'}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {athleteEmail ?? t.athletes.athleteProfile}
            </p>
            {athleteEmail && (
              <p className="text-xs text-muted-foreground">{t.athletes.athleteProfile}</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <StatsRow athleteId={athleteId} />

      {/* Charts */}
      <Tabs defaultValue="volume">
        <TabsList className="mb-4">
          <TabsTrigger value="volume">{t.athletes.tabVolume}</TabsTrigger>
          <TabsTrigger value="progression">{t.athletes.tabProgression}</TabsTrigger>
        </TabsList>

        <TabsContent value="volume">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-foreground">
              {t.analytics.weeklyVolumeTitle}
            </p>
            <AthleteVolumeChart athleteId={athleteId} />
          </div>
        </TabsContent>

        <TabsContent value="progression">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <p className="text-sm font-semibold text-foreground">
              {t.analytics.exerciseProgressionTitle}
            </p>
            <ExerciseSelector
              selected={selectedExercises}
              onAdd={handleAddExercise}
              onRemove={handleRemoveExercise}
            />
            <ExerciseProgressionChart
              exercises={selectedExercises}
              athleteId={athleteId}
              emptyPrompt={t.analytics.selectExercisePrompt}
              emptyNoData={t.analytics.noExerciseData}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Recent Sessions */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-foreground">
          {t.athletes.recentSessions}
        </h2>
        <RecentSessions athleteId={athleteId} />
      </section>
    </div>
  )
}

// ── Inline sub-component to avoid prop-drilling the athleteId ─────────────────

function AthleteVolumeChart({ athleteId }: { athleteId: string }) {
  const { t } = useI18n()
  const { data, isLoading } = useAthleteWeeklyVolume(athleteId, 26)

  if (isLoading) return <Skeleton className="h-60 w-full rounded-xl" />

  return (
    <WeeklyVolumeChart
      points={data?.points ?? []}
      weeks={26}
      totalLabel={t.analytics.tabVolume}
      emptyTitle={t.analytics.noData}
      emptyDescription={t.athletes.noSessionsDesc}
    />
  )
}
