'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, ClipboardList, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useStartSession } from '@/hooks/logs/use-start-session'
import { useI18n } from '@/providers/i18n-provider'
import type { DayTag } from '@/types/api'

// ── Day tag config ────────────────────────────────────────────────────────────

const DAY_TAGS: DayTag[] = [
  'push', 'pull', 'chest', 'back', 'shoulders', 'arms',
  'legs', 'glutes', 'core', 'upper', 'lower', 'full_body', 'cardio', 'custom',
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewSessionPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [mode, setMode] = useState<'on_the_fly' | null>(null)
  const [selectedTag, setSelectedTag] = useState<DayTag | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)

  const startSession = useStartSession()

  function handleStart() {
    if (!mode) return
    setSessionError(null)
    startSession.mutate(
      {
        mode: 'on_the_fly',
        day_tag: selectedTag ?? undefined,
      },
      {
        onSuccess: (data) => {
          router.push(`/logs/${data.id}`)
        },
        onError: (err: unknown) => {
          const status = (err as { response?: { status?: number; data?: { detail?: string } } })?.response?.status
          const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
          if (status === 409) {
            setSessionError('You already have an active session. Please finish it before starting a new one.')
          } else if (status === 403) {
            setSessionError('You need to join a gym before starting a session.')
          } else {
            setSessionError(detail ?? 'Failed to start session. Please try again.')
          }
        },
      },
    )
  }

  const isPending = startSession.isPending

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Page header */}
      <header className="flex h-16 shrink-0 items-center border-b border-border bg-background/80 px-6 backdrop-blur">
        <h1 className="text-base font-semibold text-foreground">{t.logs.newSessionTitle}</h1>
      </header>

      {/* Content */}
      <main className="flex flex-1 items-start justify-center px-4 pt-10 pb-6">
        <div className="flex w-full max-w-md flex-col gap-8">

          {/* Step 1 — Session type */}
          <section className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.logs.chooseType}
            </p>
            <div className="grid grid-cols-2 gap-3">

              {/* On the fly */}
              <button
                type="button"
                onClick={() => setMode('on_the_fly')}
                aria-pressed={mode === 'on_the_fly'}
                className={cn(
                  'flex flex-col items-start gap-3 rounded-xl border p-5 text-left transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  mode === 'on_the_fly'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-accent/30',
                )}
              >
                <span
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                    mode === 'on_the_fly' ? 'bg-primary/15' : 'bg-secondary',
                  )}
                >
                  <Zap
                    className={cn(
                      'size-5 transition-colors',
                      mode === 'on_the_fly' ? 'text-primary' : 'text-muted-foreground',
                    )}
                    aria-hidden
                  />
                </span>
                <div>
                  <p
                    className={cn(
                      'text-sm font-semibold',
                      mode === 'on_the_fly' ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    {t.logs.onTheFly}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.logs.onTheFlyDesc}
                  </p>
                </div>
              </button>

              {/* Program — coming soon */}
              <div
                className={cn(
                  'relative flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5',
                  'cursor-not-allowed opacity-50',
                )}
                aria-disabled="true"
                title={t.logs.comingSoon}
              >
                {/* Coming soon badge */}
                <span className="absolute right-3 top-3 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t.logs.comingSoon}
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <ClipboardList className="size-5 text-muted-foreground" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.logs.programMode}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.logs.programModeDesc}
                  </p>
                </div>
              </div>

            </div>
          </section>

          {/* Step 2 — Day tag (only when on_the_fly selected) */}
          {mode === 'on_the_fly' && (
            <section className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t.logs.dayTagLabel}{' '}
                <span className="font-normal normal-case tracking-normal text-muted-foreground/70">
                  ({t.logs.dayTagOptional})
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {DAY_TAGS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setSelectedTag((prev) => (prev === value ? null : value))
                    }
                    aria-pressed={selectedTag === value}
                    className={cn(
                      'rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      selectedTag === value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground hover:bg-secondary/70',
                    )}
                  >
                    {t.logs.dayTags[value]}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Error */}
          {sessionError && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {sessionError}
            </p>
          )}

          {/* CTA */}
          <Button
            className="w-full"
            size="lg"
            disabled={!mode || isPending}
            onClick={handleStart}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t.logs.starting}
              </>
            ) : (
              t.logs.startWorkout
            )}
          </Button>

        </div>
      </main>
    </div>
  )
}
