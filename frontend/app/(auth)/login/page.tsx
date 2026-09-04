import type { Metadata } from 'next'
import { LoginBrandPanel } from '@/components/auth/login-brand-panel'
import { LoginFormPanel } from '@/components/auth/login-form-header'

export const metadata: Metadata = {
  title: 'Sign in — gym-logs',
  description: 'Sign in to your gym-logs account.',
}

export default function LoginPage() {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <LoginBrandPanel />
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        <LoginFormPanel />
      </div>
    </div>
  )
}
