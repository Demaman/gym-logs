'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Activity } from 'lucide-react'
import { fillWeeklyVolumeSeries, formatWeekLabel } from '@/lib/utils'
import type { WeeklyVolumePoint } from '@/types/api'

interface WeeklyVolumeChartProps {
  points: WeeklyVolumePoint[]
  weeks?: number
  totalLabel?: string
  emptyTitle?: string
  emptyDescription?: string
}

export function WeeklyVolumeChart({
  points,
  weeks = 26,
  totalLabel = 'Volume',
  emptyTitle = 'No training data yet',
  emptyDescription = 'Log your first workout to start tracking your progress.',
}: WeeklyVolumeChartProps) {
  const chartData = fillWeeklyVolumeSeries(points, weeks)
  const hasData = chartData.some((p) => p.volume_kg > 0)

  if (!hasData) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Activity className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
        <p className="text-xs text-muted-foreground">{emptyDescription}</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="week_start"
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
          cursor={false}
          formatter={(value: unknown) => [`${value ?? ''} kg`, totalLabel]}
          labelFormatter={(label: unknown) => formatWeekLabel(String(label))}
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: 12,
            color: 'hsl(var(--foreground))',
          }}
        />
        <Bar dataKey="volume_kg" fill="hsl(263 70% 50%)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
