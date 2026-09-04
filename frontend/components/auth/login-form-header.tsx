'use client'

import Link from 'next/link'
import { useI18n } from '@/providers/i18n-provider'
import { LoginForm } from '@/components/auth/login-form'

export function LoginFormPanel() {
  const { t } = useI18n()
  const a = t.auth

  return (
    <div className="w-full max-w-sm space-y-8">

      {/* Mobile-only logo */}
      <div className="flex items-center gap-2.5 lg:hidden">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white" aria-hidden>
            <path d="M6 4h2v16H6V4zm10 0h2v16h-2V4zM3 11h18v2H3v-2z" fill="currentColor" />
          </svg>
        </span>
        <span className="text-lg font-bold tracking-tight text-foreground">gym-logs</span>
      </div>

      {/* Heading */}
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {a.loginWelcome}
        </h1>
        <p className="text-sm text-muted-foreground">{a.loginSubtitle}</p>
      </div>

      <LoginForm />

      {/* Sign-up link */}
      <p className="text-center text-sm text-muted-foreground">
        {a.loginNoAccount}{' '}
        <Link
          href="/register"
          className="font-medium text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
        >
          {a.loginCreate}
        </Link>
      </p>
    </div>
  )
}
