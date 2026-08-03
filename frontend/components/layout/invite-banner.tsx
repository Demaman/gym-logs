'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useRole } from '@/hooks/use-role'
import { useMyInvites } from '@/hooks/identity/use-invites'
import { useI18n } from '@/providers/i18n-provider'
import { cn } from '@/lib/utils'

// ── Bell badge — embedded in the sidebar's nav list ──────────────────────────

export function InviteBellBadge({ className }: { className?: string }) {
  const role = useRole()
  const { data: invites } = useMyInvites()
  const count = role === 'athlete' ? (invites?.length ?? 0) : 0

  if (!count) return null

  return (
    <span
      className={cn(
        'ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground',
        className,
      )}
      aria-label={`${count} pending invitation`}
    >
      {count}
    </span>
  )
}

// ── Notifier — fires the toast once per session when invites arrive ───────────

export function InviteNotifier() {
  const role = useRole()
  const { data: invites } = useMyInvites()
  const { t } = useI18n()
  const router = useRouter()
  const fired = useRef(false)

  useEffect(() => {
    if (role !== 'athlete') return
    if (!invites?.length) return
    if (fired.current) return
    fired.current = true

    const gymName = invites[0].organization_name ?? t.invites.unknownGym

    toast(
      <span>
        {gymName} {t.invites.bannerTitle} —{' '}
        <button
          type="button"
          className="cursor-pointer underline"
          onClick={(e) => { e.stopPropagation(); router.push('/settings') }}
        >
          {t.invites.clickHere}
        </button>
      </span>,
      {
        duration: 30000,
        style: {
          background: 'hsl(263 70% 92%)',
          color: 'hsl(263 70% 20%)',
          border: '1px solid hsl(263 50% 80%)',
          boxShadow: '0 8px 24px rgba(124, 58, 237, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1)',
        },
        classNames: { closeButton: 'border-black!' },
      },
    )
  }, [invites, role, router, t])

  return null
}
