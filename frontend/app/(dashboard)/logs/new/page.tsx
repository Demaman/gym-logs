'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, ClipboardList, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useStartSession } from '@/hooks/logs/use-start-session'
import type { DayTag } from '@/types/api'

// ── Day tag config ────────────────────────────────────────────────────────────

const DAY_TAGS: { value: DayTag; label: string }[] = [
  { value: 'push',      label: 'Push'       },
  { value: 'pull',      label: 'Pull'       },
  { value: 'legs',      label: 'Legs'       },
  { value: 'upper',     label: 'Upper'      },
  { value: 'lower',     label: 'Lower'      },
  { value: 'full_body', label: 'Full Body'  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewSessionPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'on_the_fly' | null>(null)
  const [selectedTag, setSelectedTag] = useState<DayTag | null>(null)

  const startSession = useStartSession()

  function handleStart() {
    if (!mode) return
    startSession.mutate(
      {
        mode: 'on_the_fly',
        day_tag: selectedTag ?? undefined,
      },
      {
        onSuccess: (data) => {
          router.push(`/logs/${data.id}`)
        },
      },
    )
  }

  const isPending = startSession.isPending

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Page header */}
      <header className="flex h-16 shrink-0 items-center border-b border-border bg-background/80 px-6 backdrop-blur">
        <h1 className="text-base font-semibold text-foreground">Start a workout</h1>
      </header>

      {/* Content */}
      <main className="flex flex-1 items-start justify-center px-4 pt-10 pb-6">
        <div className="flex w-full max-w-md flex-col gap-8">

          {/* Step 1 — Session type */}
          <section className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Choose session type
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
                    On the fly
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Add exercises as you go
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
                title="Coming soon"
              >
                {/* Coming soon badge */}
                <span className="absolute right-3 top-3 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Soon
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <ClipboardList className="size-5 text-muted-foreground" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Program</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Follow a training plan
                  </p>
                </div>
              </div>

            </div>
          </section>

          {/* Step 2 — Day tag (only when on_the_fly selected) */}
          {mode === 'on_the_fly' && (
            <section className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Day tag <span className="font-normal normal-case tracking-normal text-muted-foreground/70">(optional)</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {DAY_TAGS.map(({ value, label }) => (
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
                    {label}
                  </button>
                ))}
              </div>
            </section>
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
                Starting…
              </>
            ) : (
              'Start Workout'
            )}
          </Button>

        </div>
      </main>
    </div>
  )
}
