'use client'

import { useState, useMemo } from 'react'
import { Activity, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberHealth } from '@/hooks/identity/use-member-health'
import { useI18n } from '@/providers/i18n-provider'
import { Skeleton } from '@/components/ui/skeleton'
import type { MemberStatus } from '@/types/api'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<MemberStatus, { bg: string; text: string; dot: string }> = {
  active:     { bg: 'bg-emerald-500/10', text: 'text-emerald-600',  dot: 'bg-emerald-500'  },
  at_risk:    { bg: 'bg-amber-500/10',   text: 'text-amber-600',    dot: 'bg-amber-500'    },
  dormant:    { bg: 'bg-zinc-500/10',    text: 'text-zinc-500',     dot: 'bg-zinc-400'     },
  no_program: { bg: 'bg-blue-500/10',    text: 'text-blue-600',     dot: 'bg-blue-500'     },
  new:        { bg: 'bg-violet-500/10',  text: 'text-violet-600',   dot: 'bg-violet-500'   },
}

type FilterOption = MemberStatus | 'all'

const FILTER_OPTIONS: FilterOption[] = ['all', 'active', 'at_risk', 'no_program', 'dormant', 'new']

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MemberStatus }) {
  const { t } = useI18n()
  const s = STATUS_STYLES[status]
  const label: Record<MemberStatus, string> = {
    active:     t.memberHealth.active,
    at_risk:    t.memberHealth.atRisk,
    dormant:    t.memberHealth.dormant,
    no_program: t.memberHealth.noProgram,
    new:        t.memberHealth.newMember,
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', s.bg, s.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {label[status]}
    </span>
  )
}

function StatChip({
  label,
  count,
  filter,
  active,
  onClick,
}: {
  label: string
  count: number
  filter: FilterOption
  active: boolean
  onClick: () => void
}) {
  const styles: Record<FilterOption, string> = {
    all:        'border-border bg-card hover:bg-accent/50',
    active:     'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20',
    at_risk:    'border-amber-200  bg-amber-50  dark:border-amber-800  dark:bg-amber-900/20',
    dormant:    'border-zinc-200   bg-zinc-50   dark:border-zinc-700   dark:bg-zinc-800/40',
    no_program: 'border-blue-200   bg-blue-50   dark:border-blue-800   dark:bg-blue-900/20',
    new:        'border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-900/20',
  }
  const countStyles: Record<FilterOption, string> = {
    all:        'text-foreground',
    active:     'text-emerald-600',
    at_risk:    'text-amber-600',
    dormant:    'text-zinc-500',
    no_program: 'text-blue-600',
    new:        'text-violet-600',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-w-[100px] flex-col rounded-xl border p-4 text-left transition-all duration-150',
        styles[filter],
        active && 'ring-2 ring-primary ring-offset-1',
      )}
    >
      <span className={cn('text-2xl font-bold tabular-nums', countStyles[filter])}>{count}</span>
      <span className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</span>
    </button>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function MemberHealthSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-3 overflow-x-auto pb-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 min-w-[100px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MemberHealthPage() {
  const { t } = useI18n()
  const { data, isLoading } = useMemberHealth()
  const [filter, setFilter] = useState<FilterOption>('all')
  const [search, setSearch] = useState('')

  const counts = useMemo(() => {
    const all = data ?? []
    return {
      all:        all.length,
      active:     all.filter((m) => m.status === 'active').length,
      at_risk:    all.filter((m) => m.status === 'at_risk').length,
      dormant:    all.filter((m) => m.status === 'dormant').length,
      no_program: all.filter((m) => m.status === 'no_program').length,
      new:        all.filter((m) => m.status === 'new').length,
    }
  }, [data])

  const filtered = useMemo(() => {
    let list = data ?? []
    if (filter !== 'all') list = list.filter((m) => m.status === filter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((m) => m.email.toLowerCase().includes(q))
    }
    return list
  }, [data, filter, search])

  const filterLabel: Record<FilterOption, string> = {
    all:        t.memberHealth.allMembers,
    active:     t.memberHealth.active,
    at_risk:    t.memberHealth.atRisk,
    dormant:    t.memberHealth.dormant,
    no_program: t.memberHealth.noProgram,
    new:        t.memberHealth.newMember,
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-primary" aria-hidden />
          <h1 className="text-2xl font-bold">{t.memberHealth.title}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t.memberHealth.subtitle}</p>
      </div>

      {isLoading ? (
        <MemberHealthSkeleton />
      ) : (
        <>
          {/* Stat chips */}
          <div className="flex gap-3 overflow-x-auto pb-1">
            {FILTER_OPTIONS.map((f) => (
              <StatChip
                key={f}
                filter={f}
                label={filterLabel[f]}
                count={counts[f]}
                active={filter === f}
                onClick={() => setFilter(f)}
              />
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.memberHealth.searchPlaceholder}
              className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-4 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Member list */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Activity className="size-10 text-muted-foreground" aria-hidden />
              <p className="font-semibold">{t.memberHealth.emptyState}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((member) => (
                <div
                  key={member.user_id}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:gap-4"
                >
                  {/* Avatar + email */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {member.email.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{member.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.active_program_count > 0
                          ? `${member.active_program_count} ${t.memberHealth.activePrograms}`
                          : t.memberHealth.noPrograms}
                      </p>
                    </div>
                  </div>

                  {/* Last session */}
                  <div className="text-xs text-muted-foreground shrink-0">
                    <span className="font-medium text-foreground mr-1">{t.memberHealth.lastSession}:</span>
                    {member.days_since_last_session === null
                      ? t.memberHealth.neverLogged
                      : member.days_since_last_session === 0
                        ? t.memberHealth.today
                        : `${member.days_since_last_session} ${t.memberHealth.daysAgo}`}
                  </div>

                  {/* Status badge */}
                  <div className="shrink-0">
                    <StatusBadge status={member.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
