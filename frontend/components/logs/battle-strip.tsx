'use client'

import { Swords, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/providers/i18n-provider'
import type { BattleState } from '@/types/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(a: number, b: number) {
  const total = a + b
  if (total === 0) return 50
  return Math.round((a / total) * 100)
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toFixed(0)
}

// ── Exercise pill ─────────────────────────────────────────────────────────────

function ExPill({
  name,
  myScore,
  theirScore,
}: {
  name: string
  myScore: number
  theirScore: number
}) {
  const winning = myScore > theirScore
  const tied = myScore === theirScore
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        winning
          ? 'border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]'
          : tied
            ? 'border-border bg-muted/30 text-muted-foreground'
            : 'border-destructive/30 bg-destructive/10 text-destructive',
      )}
    >
      {name.length > 10 ? name.slice(0, 9) + '…' : name}
      <span>{winning ? '↑' : tied ? '=' : '↓'}</span>
    </span>
  )
}

// ── Battle strip ──────────────────────────────────────────────────────────────

interface BattleStripProps {
  battle: BattleState
  currentUserId: string | undefined
}

export function BattleStrip({ battle, currentUserId }: BattleStripProps) {
  const { t } = useI18n()
  const { initiator, opponent, status, battle_code } = battle

  // Determine which side is "me"
  const myPart =
    initiator.athlete_id === currentUserId
      ? initiator
      : opponent?.athlete_id === currentUserId
        ? opponent
        : initiator
  const theirPart =
    myPart!.athlete_id === initiator.athlete_id ? opponent : initiator

  const myScore = myPart?.score ?? 0
  const theirScore = theirPart?.score ?? 0
  const myPct = pct(myScore, theirScore)

  const noBw = !myPart?.body_weight_kg && !theirPart?.body_weight_kg

  // Merge exercises from both sides for pill list
  const myExMap = Object.fromEntries(
    (myPart?.exercises ?? []).map((e) => [e.exercise_name, e.score]),
  )
  const theirExMap = Object.fromEntries(
    (theirPart?.exercises ?? []).map((e) => [e.exercise_name, e.score]),
  )
  const allExercises = Array.from(
    new Set([
      ...(myPart?.exercises ?? []).map((e) => e.exercise_name),
      ...(theirPart?.exercises ?? []).map((e) => e.exercise_name),
    ]),
  )

  return (
    <div className="mx-4 mb-3 rounded-xl border border-primary/20 bg-primary/5 p-3 md:mx-6">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <Swords className="size-3.5 shrink-0 text-primary" aria-hidden />
        <span className="text-xs font-semibold text-primary">{t.battle.stripTitle}</span>
        {status === 'waiting' && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
            <Timer className="size-3" aria-hidden />
            {t.battle.waitingCode}{' '}
            <span className="font-mono font-bold tracking-widest text-foreground">
              {battle_code}
            </span>
          </span>
        )}
        {status === 'finished' && (
          <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {t.battle.finished}
          </span>
        )}
        {noBw && (
          <span
            className="ml-auto text-[10px] text-muted-foreground"
            title={t.battle.rawVol}
          >
            {t.battle.rawVol}
          </span>
        )}
      </div>

      {/* Scoreboard */}
      <div className="flex items-end justify-between gap-3">
        {/* My side */}
        <div className="min-w-0 flex-1 text-left">
          <p
            className={cn(
              'truncate text-xs font-semibold',
              myScore >= theirScore ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {t.battle.you}
          </p>
          <p
            className={cn(
              'text-xl font-bold tabular-nums',
              myScore >= theirScore ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {fmt(myScore)}
            <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">{t.battle.pts}</span>
          </p>
        </div>

        {/* vs */}
        <span className="shrink-0 text-[11px] font-bold text-muted-foreground">{t.battle.vs}</span>

        {/* Their side */}
        <div className="min-w-0 flex-1 text-right">
          {opponent ? (
            <>
              <p className="truncate text-xs font-bold text-foreground">
                {theirPart?.email.split('@')[0]}
              </p>
              <p className="text-xl font-bold tabular-nums text-destructive">
                {fmt(theirScore)}
                <span className="ml-0.5 text-[10px] font-normal text-destructive/70">{t.battle.pts}</span>
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{t.battle.waitingOpponent}</p>
          )}
        </div>
      </div>

      {/* Dual-color progress bar */}
      {opponent && (
        <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-muted/30">
          <div
            className="absolute inset-y-0 left-0 rounded-l-full bg-primary transition-all duration-700"
            style={{ width: `${myPct}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 rounded-r-full bg-destructive/70 transition-all duration-700"
            style={{ width: `${100 - myPct}%` }}
          />
        </div>
      )}

      {/* Exercise pills */}
      {allExercises.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {allExercises.map((name) => (
            <ExPill
              key={name}
              name={name}
              myScore={myExMap[name] ?? 0}
              theirScore={theirExMap[name] ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}
