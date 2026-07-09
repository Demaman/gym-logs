import { redirect } from 'next/navigation'

// Root: redirect unauthenticated users to /login.
// Post-login redirect to /logs is handled by the useLogin hook.
export default function RootPage() {
  redirect('/login')
}
