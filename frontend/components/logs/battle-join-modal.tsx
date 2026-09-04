'use client'

import { useState } from 'react'
import { Loader2, Swords } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useJoinBattle } from '@/hooks/logs/use-join-battle'
import { useI18n } from '@/providers/i18n-provider'

interface Props {
  open: boolean
  onClose: () => void
  prefillCode?: string
}

export function BattleJoinModal({ open, onClose, prefillCode }: Props) {
  const { t } = useI18n()
  const [code, setCode] = useState(prefillCode ?? '')
  const join = useJoinBattle(code.toUpperCase())

  async function handleJoin() {
    if (!code.trim() || join.isPending) return
    await join.mutateAsync({ name: 'Battle session', mode: 'on_the_fly' })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="size-4 text-primary" aria-hidden />
            {t.battle.joinTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <p className="text-sm text-muted-foreground">
            {t.battle.joinDesc}
          </p>

          <Input
            placeholder={t.battle.codePlaceholder}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
            className="text-center font-mono text-lg font-bold tracking-widest"
            maxLength={8}
            aria-label={t.battle.codeAriaLabel}
          />

          {join.error && (
            <p className="text-sm text-destructive">
              {(join.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
                t.battle.joinError}
            </p>
          )}

          <Button
            onClick={handleJoin}
            disabled={code.length < 4 || join.isPending}
            className="w-full"
          >
            {join.isPending ? (
              <><Loader2 className="mr-2 size-4 animate-spin" aria-hidden />{t.battle.joining}</>
            ) : (
              <><Swords className="mr-2 size-4" aria-hidden />{t.battle.joinStart}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
