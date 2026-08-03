import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { AuthGuard } from '@/components/layout/auth-guard'
import { InviteNotifier } from '@/components/layout/invite-banner'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — desktop only */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AuthGuard>
          <InviteNotifier />
          {/* On mobile, add bottom padding so content is not hidden behind the nav bar */}
          <div className="flex flex-1 flex-col overflow-y-auto pb-16 lg:pb-0">
            {children}
          </div>
        </AuthGuard>
      </div>

      {/* Mobile bottom nav — only visible on < lg */}
      <MobileNav />
    </div>
  )
}
