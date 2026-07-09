import type { Metadata } from 'next'
import { RegisterForm } from '@/components/auth/register-form'

export const metadata: Metadata = {
  title: 'Create account — gym-logs',
  description: 'Create your gym-logs account.',
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">

      {/* ── Left: brand panel (hidden on mobile) ─────────────── */}
      <div className="relative hidden lg:flex lg:flex-col lg:justify-between bg-zinc-950 px-12 py-10 text-white">

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_#4c1d95_0%,_transparent_60%)] opacity-40"
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white" aria-hidden>
              <path d="M6 4h2v16H6V4zm10 0h2v16h-2V4zM3 11h18v2H3v-2z" fill="currentColor" />
            </svg>
          </span>
          <span className="text-lg font-bold tracking-tight">gym-logs</span>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 space-y-4">
          <p className="text-4xl font-bold leading-tight tracking-tight">
            Start your journey.<br />
            <span className="text-zinc-400">Your first rep begins here.</span>
          </p>
          <ul className="mt-6 space-y-3 text-sm text-zinc-400">
            <li className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">✓</span>
              Free to get started — no credit card
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">✓</span>
              Log workouts from day one
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">✓</span>
              Connect with your trainer or gym
            </li>
          </ul>
        </div>

        <p className="relative z-10 text-xs text-zinc-600">© 2026 gym-logs</p>
      </div>

      {/* ── Right: form panel ─────────────────────────────────── */}
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
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

          <RegisterForm />
        </div>
      </div>

    </div>
  )
}
