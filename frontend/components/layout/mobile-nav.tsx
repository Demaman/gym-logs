'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Dumbbell,
  BookOpen,
  TrendingUp,
  Users,
  ClipboardList,
  LayoutDashboard,
  HeartPulse,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/auth/store'
import { useI18n } from '@/providers/i18n-provider'
import type { Role } from '@/hooks/use-role'

// ── Nav items per role (mobile: max 4 items) ──────────────────────────────────

type MobileNavItem = { href: string; labelKey: keyof ReturnType<typeof useI18n>['t']['nav']; icon: React.ElementType }

const MOBILE_NAV_BY_ROLE: Record<Role, MobileNavItem[]> = {
  athlete: [
    { href: '/logs',      labelKey: 'logs',      icon: Dumbbell   },
    { href: '/training',  labelKey: 'training',  icon: BookOpen   },
    { href: '/health',    labelKey: 'health',    icon: HeartPulse },
    { href: '/analytics', labelKey: 'analytics', icon: TrendingUp },
  ],
  trainer: [
    { href: '/overview',  labelKey: 'overview',     icon: LayoutDashboard },
    { href: '/logs',      labelKey: 'logs',         icon: ClipboardList   },
    { href: '/athletes',  labelKey: 'athletes',     icon: Users           },
    { href: '/training',  labelKey: 'programs',     icon: BookOpen        },
  ],
  gym_admin: [
    { href: '/overview',  labelKey: 'overview',  icon: LayoutDashboard },
    { href: '/athletes',  labelKey: 'members',   icon: Users           },
    { href: '/training',  labelKey: 'training',  icon: BookOpen        },
    { href: '/analytics', labelKey: 'analytics', icon: TrendingUp      },
  ],
}

export function MobileNav() {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const { t } = useI18n()

  const role = (user?.role ?? 'athlete') as Role
  const navItems = MOBILE_NAV_BY_ROLE[role] ?? MOBILE_NAV_BY_ROLE.athlete

  return (
    <nav
      aria-label={t.nav.menu}
      className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-stretch border-t border-border bg-card lg:hidden"
    >
      {navItems.map(({ href, labelKey, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        const label = t.nav[labelKey]
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors duration-150',
              active
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon
              className={cn('size-5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')}
              aria-hidden
            />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
