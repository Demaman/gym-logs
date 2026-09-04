'use client'

import { useRouter } from 'next/navigation'
import { Swords, Trophy, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useI18n } from '@/providers/i18n-provider'
import { useAuthStore } from '@/lib/auth/store'
import { useBattleHistory } from '@/hooks/logs/use-battle-history'
import type { BattleState } from '@/types/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toFixed(0)
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-24 rounded" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-6 w-16 rounded" />
          <Skeleton className="h-3 w-28 rounded" />
        </div>
        <Skeleton className="h-4 w-4 rounded" />
      </div>
    </div>
  )
}

// ── Battle card ───────────────────────────────────────────────────────────────

function BattleCard({
  battle,
  currentUserId,
}: {
  battle: BattleState
  currentUserId: string | undefined
}) {
  const { t } = useI18n()
  const router = useRouter()

  const me =
    battle.opponent !== null && battle.opponent.athlete_id === currentUserId
      ? battle.opponent
      : battle.initiator
  const them =
    me.athlete_id === battle.initiator.athlete_id
      ? battle.opponent
      : battle.initiator

  const myScore = me.score
  const theirScore = them?.score ?? 0
  const iWon = battle.status === 'finished' && myScore > theirScore
  const tied = battle.status === 'finished' && myScore === theirScore
  const iLost = battle.status === 'finished' && myScore < theirScore

  const resultLabel = battle.status === 'finished'
    ? iWon ? t.battle.won : tied ? t.battle.drew : t.battle.lost
    : battle.status === 'active'
      ? t.battle.inProgress
      : t.battle.oppWaiting

  const resultColor = battle.status === 'finished'
    ? iWon
      ? 'bg-[color:var(--success)]/10 text-[color:var(--success)]'
      : tied
        ? 'bg-secondary text-muted-foreground'
        : 'bg-destructive/10 text-destructive'
    : 'bg-primary/10 text-primary'

  // Navigate to the session summary for the user's own session
  function handleClick() {
    router.push(`/logs/${me.session_id}/summary`)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group w-full rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30 hover:bg-accent/30"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        {/* Result badge */}
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
            resultColor,
          )}
        >
          {iWon && <Trophy className="size-3" aria-hidden />}
          {resultLabel}
        </span>

        {/* Date */}
        {battle.finished_at && (
          <span className="text-xs text-muted-foreground">
            {formatDate(battle.finished_at)}
          </span>
        )}
      </div>

      {/* Score row */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {them ? (
            <p className="truncate text-sm text-muted-foreground">
              vs <span className="font-bold text-foreground">{them.email.split('@')[0]}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t.battle.oppWaiting}</p>
          )}
        </div>
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>

      {/* Dual-color score bar */}
      {them && (() => {
        const total = myScore + theirScore
        const myPct = total === 0 ? 50 : Math.round((myScore / total) * 100)
        const myBarCls = 'bg-primary'
        const theirBarCls = 'bg-destructive/70'
        return (
          <div className="mt-2">
            <div className="mb-1 flex justify-between text-[10px] tabular-nums">
              <span className="text-muted-foreground">{fmt(myScore)} pts</span>
              <span className="text-destructive">{fmt(theirScore)} pts</span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-muted/30">
              <div
                className={cn('absolute inset-y-0 left-0 rounded-l-full transition-all duration-500', myBarCls)}
                style={{ width: `${myPct}%` }}
              />
              <div
                className={cn('absolute inset-y-0 right-0 rounded-r-full transition-all duration-500', theirBarCls)}
                style={{ width: `${100 - myPct}%` }}
              />
            </div>
          </div>
        )
      })()}

      {/* Exercise pills */}
      {me.exercises.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {me.exercises.slice(0, 4).map((ex) => (
            <span
              key={ex.exercise_name}
              className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {ex.exercise_name.length > 12
                ? ex.exercise_name.slice(0, 11) + '…'
                : ex.exercise_name}
            </span>
          ))}
          {me.exercises.length > 4 && (
            <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground">
              +{me.exercises.length - 4}
            </span>
          )}
        </div>
      )}
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BattleHistoryPage() {
  const { t } = useI18n()
  const router = useRouter()
  const currentUser = useAuthStore((s) => s.user)
  const { data: battles, isLoading } = useBattleHistory()

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center border-b border-border bg-background/80 px-6 backdrop-blur">
        <div className="flex-1">
          <h1 className="text-base font-semibold text-foreground">
            {t.battle.battleHistoryTitle}
          </h1>
          <p className="text-xs text-muted-foreground">{t.battle.battleHistorySubtitle}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => router.push('/logs')}
        >
          <Swords className="size-4" aria-hidden />
          {t.battle.joinBattle}
        </Button>
      </header>

      <main className="flex-1 space-y-3 p-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
        ) : !battles || battles.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Swords className="size-10 text-muted-foreground/30" aria-hidden />
            <p className="font-semibold text-foreground">{t.battle.noBattles}</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              {t.battle.noBattlesDesc}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push('/logs')}
            >
              {t.logs.logWorkout}
            </Button>
          </div>
        ) : (
          battles.map((battle) => (
            <BattleCard
              key={battle.id}
              battle={battle}
              currentUserId={currentUser?.id}
            />
          ))
        )}
      </main>
    </div>
  )
}
