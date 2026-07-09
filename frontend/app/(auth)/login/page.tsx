import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Sign in — gym-logs',
  description: 'Sign in to your gym-logs account.',
}

export default function LoginPage() {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">

      {/* ── Left: brand panel (hidden on mobile) ─────────────── */}
      <div className="relative hidden lg:flex lg:flex-col lg:justify-between bg-zinc-950 px-12 py-10 text-white">

        {/* Subtle radial gradient for depth */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_#4c1d95_0%,_transparent_60%)] opacity-40"
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white" aria-hidden>
              <path
                d="M6 4h2v16H6V4zm10 0h2v16h-2V4zM3 11h18v2H3v-2z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span className="text-lg font-bold tracking-tight">gym-logs</span>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 space-y-4">
          <p className="text-4xl font-bold leading-tight tracking-tight">
            Track every rep.<br />
            <span className="text-zinc-400">Own your progress.</span>
          </p>
          <ul className="mt-6 space-y-3 text-sm text-zinc-400">
            <li className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">✓</span>
              Log workouts and track every set
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">✓</span>
              Visualise progression over time
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">✓</span>
              Build and assign training programs
            </li>
          </ul>
        </div>

        {/* Footer */}
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

          {/* Heading */}
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in to continue to gym-logs
            </p>
          </div>

          {/* Form */}
          <LoginForm />

          {/* Sign-up link */}
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <a
              href="/register"
              className="font-medium text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
            >
              Create one
            </a>
          </p>
        </div>
      </div>

    </div>
  )
}
