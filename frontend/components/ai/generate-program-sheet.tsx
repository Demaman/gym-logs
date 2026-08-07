'use client'
import { useEffect, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import type { AxiosError } from 'axios'
import { useI18n } from '@/providers/i18n-provider'
import { useGenerateProgram } from '@/hooks/ai/use-generate-program'
import type { MembershipEnriched } from '@/types/api'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: (programId: string) => void
  isPro: boolean
  athletes?: MembershipEnriched[]
  role: string
}

export function GenerateProgramSheet({ open, onClose, onSuccess, isPro, athletes, role }: Props) {
  const { t, locale } = useI18n()
  const [notes, setNotes] = useState('')
  const [athleteId, setAthleteId] = useState('')
  const mutation = useGenerateProgram()

  useEffect(() => {
    if (!open) {
      setNotes('')
      setAthleteId('')
      mutation.reset()
    }
  }, [open])

  if (!open) return null

  async function handleGenerate() {
    try {
      const result = await mutation.mutateAsync({
        athlete_id: athleteId || null,
        notes: notes.trim() || null,
        locale,
      })
      onSuccess(result.id)
      onClose()
    } catch {
      // error is surfaced via mutation.error below
    }
  }

  const isTrainer = role === 'trainer' || role === 'gym_admin'
  const axiosErr = mutation.error as AxiosError<{ detail?: string }> | null
  const httpStatus = axiosErr?.response?.status
  const errorMessage =
    axiosErr?.response?.data?.detail ?? axiosErr?.message ?? null
  const is402 = httpStatus === 402
  const is503 = httpStatus === 503

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[420px] sm:-translate-x-1/2 sm:-translate-y-1/2"
        role="dialog"
        aria-modal
        aria-label={t.training.generateWithAI}
      >
        <div className="rounded-t-2xl border-t border-border bg-card p-6 shadow-xl sm:rounded-2xl sm:border">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-violet-500" aria-hidden />
              <h3 className="text-base font-semibold text-foreground">{t.training.generateWithAI}</h3>
            </div>
            <button
              type="button"
              aria-label={t.common.close}
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          {!isPro ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg bg-amber-500/10 px-4 py-3">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{t.training.upgradeRequired}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t.training.upgradeRequiredDesc}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                {t.common.close}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {is402 && (
                <div className="rounded-lg bg-amber-500/10 px-4 py-3">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{t.training.upgradeRequired}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t.training.upgradeRequiredDesc}</p>
                </div>
              )}
              {is503 && (
                <div className="rounded-lg bg-destructive/10 px-4 py-3">
                  <p className="text-sm font-medium text-destructive">{t.training.aiNotConfigured}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t.training.aiNotConfiguredDesc}</p>
                </div>
              )}
              {mutation.error && !is402 && !is503 && (
                <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {errorMessage ?? 'Something went wrong. Please try again.'}
                </p>
              )}

              {isTrainer && athletes && athletes.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ai-athlete" className="text-sm font-medium text-foreground">
                    {t.training.aiForAthlete}
                  </label>
                  <p className="text-xs text-muted-foreground">{t.training.aiForAthleteDesc}</p>
                  <select
                    id="ai-athlete"
                    value={athleteId}
                    onChange={(e) => setAthleteId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">— {t.training.forMyself} —</option>
                    {athletes.map((a) => (
                      <option key={a.athlete_id} value={a.athlete_id}>
                        {a.athlete_email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="ai-notes" className="text-sm font-medium text-foreground">
                  {t.training.aiNotes}
                </label>
                <textarea
                  id="ai-notes"
                  rows={3}
                  placeholder={t.training.aiNotesPlaceholder}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              {mutation.isPending && (
                <p className="text-center text-sm text-muted-foreground">{t.training.generatingDesc}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={mutation.isPending}
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={mutation.isPending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {mutation.isPending ? (
                    <>
                      <span className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      {t.training.generating}
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" aria-hidden />
                      {t.training.generateWithAI}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
