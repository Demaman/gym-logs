import { Sidebar } from '@/components/layout/sidebar'
import { AuthGuard } from '@/components/layout/auth-guard'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — desktop only for now; mobile drawer comes later */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AuthGuard>{children}</AuthGuard>
      </div>
    </div>
  )
}
