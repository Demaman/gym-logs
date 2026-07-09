import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Forgot password — gym-logs',
}

// H3 fix: "Forgot password?" links to a real page, not a dead link.
// Password reset requires admin action for now — this page explains the process.
export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-primary" aria-hidden>
              <path
                d="M12 1C8.676 1 6 3.676 6 7v1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-2V7c0-3.324-2.676-6-6-6zm0 2c2.276 0 4 1.724 4 4v1H8V7c0-2.276 1.724-4 4-4zm0 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"
                fill="currentColor"
              />
            </svg>
          </span>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Forgot your password?</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Password resets are managed by your gym administrator.
            Contact them to reset your credentials.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background-subtle p-4 text-left text-sm space-y-2">
          <p className="font-semibold text-foreground">What to do:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Contact your gym admin or trainer</li>
            <li>Ask them to reset your password from the admin panel</li>
            <li>You will receive a new temporary password</li>
          </ol>
        </div>
        <Link
          href="/login"
          className="inline-flex text-sm text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
        >
          ← Back to sign in
        </Link>
      </div>
    </div>
  )
}
