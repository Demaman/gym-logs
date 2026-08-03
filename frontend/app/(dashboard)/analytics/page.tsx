'use client'

import { useState, useRef } from 'react'
import { X, Loader2, Search } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { WeeklyVolumeChart } from '@/components/charts/weekly-volume-chart'
import { ExerciseProgressionChart, seriesColor } from '@/components/charts/exercise-progression-chart'
import { BodyMeasurementChart } from '@/components/charts/body-measurement-chart'
import { useI18n } from '@/providers/i18n-provider'
import { useProgressStats } from '@/hooks/logs/use-progress-stats'
import { useWeeklyVolume } from '@/hooks/logs/use-weekly-volume'
import { useExerciseSearch } from '@/hooks/training/use-exercises'
import { cn } from '@/lib/utils'
import type { Exercise } from '@/types/api'

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold tabular-nums">
        {value}
        {unit && (
          <span className="ml-1 text-base font-medium text-muted-foreground">{unit}</span>
        )}
      </p>
    </div>
  )
}

// ── StatsRow ──────────────────────────────────────────────────────────────────

function StatsRow() {
  const { t } = useI18n()
  const a = t.analytics
  const { data: stats, isLoading } = useProgressStats()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  const fmtVolume = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label={a.totalSessions} value={String(stats?.total_sessions ?? 0)} />
      <StatCard
        label={a.totalVolume}
        value={fmtVolume(stats?.total_volume_kg ?? 0)}
        unit="kg"
      />
      <StatCard
        label={a.sessionsThisMonth}
        value={String(stats?.sessions_this_month ?? 0)}
      />
      <StatCard
        label={a.avgVolumePerSession}
        value={fmtVolume(stats?.avg_volume_per_session ?? 0)}
        unit="kg"
      />
    </div>
  )
}

// ── ExerciseSelector ──────────────────────────────────────────────────────────

interface ExerciseSelectorProps {
  selectedExercises: Exercise[]
  onSelect: (e: Exercise) => void
  onRemove: (id: string) => void
}

function ExerciseSelector({ selectedExercises, onSelect, onRemove }: ExerciseSelectorProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: results = [], isFetching } = useExerciseSearch(
    { query: query.trim(), limit: 15 },
    { enabled: query.trim().length > 0 },
  )

  // Filter out already-selected exercises
  const available = results.filter((r) => !selectedExercises.find((s) => s.id === r.id))

  function select(e: Exercise) {
    onSelect(e)
    setQuery('')
    setShowResults(false)
    inputRef.current?.focus()
  }

  return (
    <div className="space-y-3">
      {/* Selected exercise chips */}
      {selectedExercises.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedExercises.map((ex, i) => (
            <div
              key={ex.id}
              className="flex items-center gap-1.5 rounded-full border border-border bg-secondary py-1 pl-3 pr-2 text-xs font-medium text-foreground"
            >
              {/* Color dot matching chart line */}
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: seriesColor(i) }}
                aria-hidden
              />
              <span>{ex.name}</span>
              <button
                type="button"
                onClick={() => onRemove(ex.id)}
                aria-label={`Remove ${ex.name}`}
                className={cn(
                  'ml-0.5 rounded-full p-0.5 text-muted-foreground transition-colors',
                  'hover:bg-destructive/10 hover:text-destructive',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                <X className="size-3" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        {isFetching && (
          <Loader2
            className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        )}
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowResults(true) }}
          onFocus={() => { if (query.trim()) setShowResults(true) }}
          onBlur={() => setTimeout(() => setShowResults(false), 150)}
          placeholder={t.analytics.searchExercises}
          className="pl-9 pr-9 sm:max-w-sm"
          aria-label={t.analytics.searchExercises}
        />
        {showResults && query.trim().length > 0 && (
          <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-md sm:max-w-sm">
            {isFetching && (
              <div className="px-3 py-2 text-sm text-muted-foreground">Loading…</div>
            )}
            {!isFetching && available.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {results.length === 0 ? 'No exercises found.' : 'All matches already selected.'}
              </div>
            )}
            {available.map((ex) => (
              <button
                key={ex.id}
                onMouseDown={() => select(ex)}
                className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
              >
                <span className="font-medium">{ex.name}</span>
                <span className="ml-2 text-xs capitalize text-muted-foreground">
                  {ex.muscle_group.replace('_', ' ')}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── AnalyticsPage ─────────────────────────────────────────────────────────────

const VOLUME_WEEKS = 26

export default function AnalyticsPage() {
  const { t } = useI18n()
  const a = t.analytics
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([])
  const { data: weeklyData, isLoading: volumeLoading } = useWeeklyVolume(VOLUME_WEEKS)

  function addExercise(ex: Exercise) {
    setSelectedExercises((prev) =>
      prev.find((e) => e.id === ex.id) ? prev : [...prev, ex],
    )
  }

  function removeExercise(id: string) {
    setSelectedExercises((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <div className="p-4 pb-24 sm:p-6 lg:pb-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{a.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{a.subtitle}</p>
      </div>

      {/* Stats */}
      <div className="mb-6">
        <StatsRow />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="volume">
        <TabsList className="mb-4">
          <TabsTrigger value="volume">{a.tabVolume}</TabsTrigger>
          <TabsTrigger value="exercise">{a.tabExercise}</TabsTrigger>
          <TabsTrigger value="body">{a.tabBody}</TabsTrigger>
        </TabsList>

        {/* Volume tab */}
        <TabsContent value="volume">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {a.weeklyVolumeTitle}
            </p>
            <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
              {a.weeklyVolumeSubtitle}
            </p>
            {volumeLoading ? (
              <Skeleton className="h-60 w-full rounded-xl" />
            ) : (
              <WeeklyVolumeChart
                points={weeklyData?.points ?? []}
                weeks={VOLUME_WEEKS}
                totalLabel={a.totalVolume}
                emptyTitle={a.noData}
                emptyDescription={a.noDataDesc}
              />
            )}
          </div>
        </TabsContent>

        {/* Exercise progression tab */}
        <TabsContent value="exercise">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {a.exerciseProgressionTitle}
            </p>
            <ExerciseSelector
              selectedExercises={selectedExercises}
              onSelect={addExercise}
              onRemove={removeExercise}
            />
            <div className="mt-4">
              <ExerciseProgressionChart
                exercises={selectedExercises.map((e) => ({ id: e.id, name: e.name }))}
                emptyPrompt={a.selectExercisePrompt}
                emptyNoData={a.noExerciseData}
              />
            </div>
          </div>
        </TabsContent>

        {/* Body measurements tab */}
        <TabsContent value="body">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {a.bodyTitle}
            </p>
            <BodyMeasurementChart
              metrics={[
                { key: 'weight_kg',     label: a.bodyMetricWeight      },
                { key: 'body_fat_pct',  label: a.bodyMetricBodyFat     },
                { key: 'lean_mass_kg',  label: a.bodyMetricLeanMass    },
                { key: 'waist_cm',      label: a.bodyMetricWaist       },
                { key: 'hip_cm',        label: a.bodyMetricHip         },
                { key: 'chest_cm',      label: a.bodyMetricChest       },
                { key: 'upper_arm_cm',  label: a.bodyMetricUpperArm    },
                { key: 'thigh_cm',      label: a.bodyMetricThigh       },
                { key: 'calf_cm',       label: a.bodyMetricCalf        },
                { key: 'resting_hr',    label: a.bodyMetricRestingHr   },
                { key: 'bp_systolic',   label: a.bodyMetricBpSystolic  },
                { key: 'bp_diastolic',  label: a.bodyMetricBpDiastolic },
              ]}
              emptyTitle={a.noMeasurements}
              emptyDescription={a.noMeasurementsDesc}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
