'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Copy, Check, Loader2, Swords } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useStartBattle } from '@/hooks/logs/use-start-battle'
import { useSessionBattle } from '@/hooks/logs/use-session-battle'
import { useI18n } from '@/providers/i18n-provider'
import type { BattleState } from '@/types/api'

const QRCode = dynamic(() => import('react-qr-code').then((m) => ({ default: m.default ?? m.QRCode })), {
  ssr: false,
  loading: () => <div className="size-32 rounded-lg bg-muted animate-pulse" />,
})

interface Props {
  open: boolean
  onClose: () => void
  sessionId: string
  existingBattle?: BattleState | null
}

export function BattleInitiateModal({ open, onClose, sessionId, existingBattle }: Props) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const startBattle = useStartBattle(sessionId)
  const [battleId, setBattleId] = useState<string | null>(existingBattle?.id ?? null)
  const { data: battle } = useSessionBattle(battleId ? sessionId : undefined)

  const displayBattle = existingBattle ?? battle

  async function handleStart() {
    if (startBattle.isPending) return
    const result = await startBattle.mutateAsync()
    setBattleId(result.id)
  }

  async function copy() {
    if (!displayBattle) return
    await navigator.clipboard.writeText(displayBattle.battle_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const joinUrl =
    typeof window !== 'undefined' && displayBattle
      ? `${window.location.origin}/logs/join-battle/${displayBattle.battle_code}`
      : null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="size-4 text-primary" aria-hidden />
            {t.battle.modalTitle}
          </DialogTitle>
        </DialogHeader>

        {!displayBattle ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-center text-sm text-muted-foreground">
              {t.battle.modalDesc}
            </p>
            <Button
              onClick={handleStart}
              disabled={startBattle.isPending}
              className="w-full"
            >
              {startBattle.isPending ? (
                <><Loader2 className="mr-2 size-4 animate-spin" aria-hidden />{t.battle.starting}</>
              ) : (
                <><Swords className="mr-2 size-4" aria-hidden />{t.battle.startBattle}</>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-2">
            {/* Battle code */}
            <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
              <span className="flex-1 text-center font-mono text-2xl font-bold tracking-[0.3em] text-foreground">
                {displayBattle.battle_code}
              </span>
              <button
                type="button"
                onClick={copy}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={t.battle.copyCode}
              >
                {copied ? (
                  <Check className="size-4 text-[color:var(--success)]" aria-hidden />
                ) : (
                  <Copy className="size-4" aria-hidden />
                )}
              </button>
            </div>

            {/* QR code */}
            {joinUrl && (
              <div className="rounded-xl border border-border bg-white p-3">
                <QRCode value={joinUrl} size={140} />
              </div>
            )}

            {/* Status */}
            {displayBattle.status === 'waiting' ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t.battle.waitingToJoin}
              </div>
            ) : (
              <p className="text-sm font-medium text-[color:var(--success)]">
                {t.battle.opponentJoined}
              </p>
            )}

            <p className="text-center text-[10px] text-muted-foreground">
              {t.battle.shareHint}
            </p>

            <Button variant="outline" onClick={onClose} className="w-full">
              {t.common.close}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
