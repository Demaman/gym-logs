'use client'

import { Dumbbell, Swords, BarChart2, Users, ClipboardList, Zap } from 'lucide-react'
import { useI18n } from '@/providers/i18n-provider'

const FEATURE_KEYS = [
  { icon: Dumbbell,      titleKey: 'feat1Title', descKey: 'feat1Desc' },
  { icon: Swords,        titleKey: 'feat2Title', descKey: 'feat2Desc' },
  { icon: BarChart2,     titleKey: 'feat3Title', descKey: 'feat3Desc' },
  { icon: ClipboardList, titleKey: 'feat4Title', descKey: 'feat4Desc' },
  { icon: Users,         titleKey: 'feat5Title', descKey: 'feat5Desc' },
  { icon: Zap,           titleKey: 'feat6Title', descKey: 'feat6Desc' },
] as const

export function LoginBrandPanel() {
  const { t } = useI18n()
  const a = t.auth

  return (
    <div className="relative hidden lg:flex lg:flex-col lg:justify-between overflow-hidden bg-zinc-950 px-12 py-10 text-white">

      {/* Background gradients */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_#4c1d95_0%,_transparent_55%)] opacity-50" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_#1e1b4b_0%,_transparent_60%)] opacity-40" />

      {/* Logo */}
      <div className="relative z-10 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white" aria-hidden>
            <path d="M6 4h2v16H6V4zm10 0h2v16h-2V4zM3 11h18v2H3v-2z" fill="currentColor" />
          </svg>
        </span>
        <span className="text-lg font-bold tracking-tight">gym-logs</span>
      </div>

      {/* Hero headline */}
      <div className="relative z-10 space-y-2">
        <p className="text-4xl font-bold leading-tight tracking-tight">
          {a.loginHero}<br />
          <span className="text-zinc-400">{a.loginHeroSub}</span>
        </p>
        <p className="text-sm text-zinc-500">{a.loginTagline}</p>
      </div>

      {/* Feature grid */}
      <div className="relative z-10 grid grid-cols-2 gap-3">
        {FEATURE_KEYS.map(({ icon: Icon, titleKey, descKey }) => (
          <div
            key={titleKey}
            className="rounded-xl border border-white/8 bg-white/5 p-4 backdrop-blur-sm"
          >
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
              <Icon className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <p className="mb-1 text-sm font-semibold text-white">{a[titleKey]}</p>
            <p className="text-xs leading-relaxed text-zinc-400">{a[descKey]}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <p className="relative z-10 text-xs text-zinc-600">{a.loginCopyright}</p>
    </div>
  )
}
