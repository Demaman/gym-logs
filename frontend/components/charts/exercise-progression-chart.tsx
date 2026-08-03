'use client'

import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatWeekLabel } from '@/lib/utils'
import { useMultipleExerciseHistory } from '@/hooks/logs/use-multiple-exercise-history'

// Series colors that complement the design system palette
const SERIES_COLORS = [
  'hsl(263 70% 50%)',  // primary violet
  'hsl(160 84% 39%)',  // success emerald
  'hsl(38 92% 50%)',   // warning amber
  'hsl(200 80% 48%)',  // sky blue
  'hsl(340 70% 52%)',  // rose
  'hsl(280 65% 55%)',  // purple
]

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length]
}

interface SelectedExercise {
  id: string
  name: string
}

interface ExerciseProgressionChartProps {
  exercises: SelectedExercise[]
  emptyPrompt?: string
  emptyNoData?: string
}

export function ExerciseProgressionChart({
  exercises,
  emptyPrompt = 'Select an exercise to view its history',
  emptyNoData = 'No history for these exercises yet.',
}: ExerciseProgressionChartProps) {
  const results = useMultipleExerciseHistory(exercises.map((e) => e.id))

  const isLoading = results.some((r) => r.isLoading)

  // Merge all series into a single dataset keyed by date
  const chartData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number | null>>()

    results.forEach((r, i) => {
      const ex = exercises[i]
      if (!r.data) return
      r.data.points.forEach((p) => {
        if (!dateMap.has(p.session_date)) {
          dateMap.set(p.session_date, {})
        }
        const row = dateMap.get(p.session_date)!
        row[ex.id] = p.best_weight_kg
      })
    })

    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }))
  }, [results, exercises])

  if (exercises.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <TrendingUp className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{emptyPrompt}</p>
      </div>
    )
  }

  if (isLoading) return <Skeleton className="h-60 w-full rounded-xl" />

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <TrendingUp className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{emptyNoData}</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={formatWeekLabel}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          formatter={(value: unknown, _key: unknown, props: unknown) => {
            const dataKey = (props as { dataKey?: unknown }).dataKey
            const ex = exercises.find((e) => e.id === dataKey)
            return [`${value ?? ''} kg`, ex?.name ?? '']
          }}
          labelFormatter={(label: unknown) => formatWeekLabel(String(label))}
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: 12,
            color: 'hsl(var(--foreground))',
          }}
        />
        {exercises.length > 1 && (
          <Legend
            formatter={(value) => {
              const ex = exercises.find((e) => e.id === value)
              return (
                <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                  {ex?.name ?? value}
                </span>
              )
            }}
          />
        )}
        {exercises.map((ex, i) => (
          <Line
            key={ex.id}
            type="monotone"
            dataKey={ex.id}
            stroke={seriesColor(i)}
            strokeWidth={2}
            dot={{ r: 4, fill: seriesColor(i) }}
            activeDot={{ r: 5 }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
