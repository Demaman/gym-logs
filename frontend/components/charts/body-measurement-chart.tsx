'use client'

import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Activity } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn, formatWeekLabel } from '@/lib/utils'
import { useMeasurements } from '@/hooks/analytics/use-anamnesis'
import type { BodyMeasurement } from '@/types/api'

type MetricKey =
  | 'weight_kg' | 'body_fat_pct' | 'lean_mass_kg'
  | 'waist_cm' | 'hip_cm' | 'chest_cm' | 'upper_arm_cm'
  | 'thigh_cm' | 'calf_cm' | 'resting_hr'
  | 'bp_systolic' | 'bp_diastolic'

interface MetricOption {
  key: MetricKey
  label: string
}

const DEFAULT_METRICS: MetricOption[] = [
  { key: 'weight_kg',    label: 'Weight (kg)'     },
  { key: 'body_fat_pct', label: 'Body Fat (%)'    },
  { key: 'lean_mass_kg', label: 'Lean Mass (kg)'  },
  { key: 'waist_cm',     label: 'Waist (cm)'      },
]

interface BodyMeasurementChartProps {
  metrics?: MetricOption[]
  emptyTitle?: string
  emptyDescription?: string
}

export function BodyMeasurementChart({
  metrics = DEFAULT_METRICS,
  emptyTitle = 'No measurements yet',
  emptyDescription = 'Log a body measurement in the Health page to start tracking.',
}: BodyMeasurementChartProps) {
  const { data: measurements = [], isLoading } = useMeasurements()
  const [metric, setMetric] = useState<MetricKey>(metrics[0]?.key ?? 'weight_kg')

  if (isLoading) return <Skeleton className="h-60 w-full rounded-xl" />

  const chartData = (measurements as BodyMeasurement[])
    .filter((m) => m[metric] !== null)
    .map((m) => ({ date: m.measured_at, value: m[metric] as number }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const activeMetric = metrics.find((o) => o.key === metric)

  return (
    <div className="space-y-4">
      {/* Metric selector */}
      <div className="flex flex-wrap gap-2">
        {metrics.map(({ key, label }) => (
          <Button
            key={key}
            variant={metric === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMetric(key)}
            className={cn(metric === key && 'pointer-events-none')}
          >
            {label}
          </Button>
        ))}
      </div>

      {chartData.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Activity className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
          <p className="text-xs text-muted-foreground">{emptyDescription}</p>
        </div>
      ) : (
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
              formatter={(value: unknown) => [`${value ?? ''}`, activeMetric?.label ?? metric]}
              labelFormatter={(label: unknown) => formatWeekLabel(String(label))}
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: 12,
                color: 'hsl(var(--foreground))',
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(263 70% 50%)"
              strokeWidth={2}
              dot={{ r: 4, fill: 'hsl(263 70% 50%)', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: 'hsl(263 70% 50%)', strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
