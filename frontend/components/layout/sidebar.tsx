'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Dumbbell,
  BookOpen,
  TrendingUp,
  Users,
  ClipboardList,
  UserCheck,
  LayoutDashboard,
  Link2,
  LogOut,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/auth/store'
import { useLogout } from '@/hooks/use-logout'
import type { Role } from '@/hooks/use-role'

// ── Nav items per role ─────────────────────────────────────────────────────────

type NavItem = { href: string; label: string; icon: React.ElementType }

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  athlete: [
    { href: '/logs',      label: 'My Logs',  icon: Dumbbell       },
    { href: '/training',  label: 'Training', icon: BookOpen       },
    { href: '/analytics', label: 'Progress', icon: TrendingUp     },
  ],
  trainer: [
    { href: '/logs',      label: 'Logs',        icon: ClipboardList  },
    { href: '/athletes',  label: 'My Athletes', icon: Users          },
    { href: '/training',  label: 'Programs',    icon: BookOpen       },
    { href: '/analytics', label: 'Analytics',   icon: TrendingUp     },
  ],
  gym_admin: [
    { href: '/overview',  label: 'Overview',  icon: LayoutDashboard },
    { href: '/trainers',  label: 'Trainers',  icon: UserCheck       },
    { href: '/athletes',  label: 'Athletes',  icon: Users           },
    { href: '/training',  label: 'Training',  icon: BookOpen        },
    { href: '/analytics', label: 'Analytics', icon: TrendingUp      },
    { href: '/members',   label: 'Members',   icon: Link2           },
  ],
}

const ROLE_LABEL: Record<Role, string> = {
  athlete:   'Athlete',
  trainer:   'Trainer',
  gym_admin: 'Gym Admin',
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ email, size = 'md' }: { email: string; size?: 'sm' | 'md' }) {
  const initials = email.split('@')[0].slice(0, 2).toUpperCase()
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground',
        size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm',
      )}
      aria-hidden
    >
      {initials}
    </span>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const { mutate: logout, isPending: isLoggingOut } = useLogout()

  const displayName = user?.email.split('@')[0] ?? 'User'
  const role        = (user?.role ?? 'athlete') as Role
  const roleLabel   = ROLE_LABEL[role] ?? 'Member'
  const email       = user?.email ?? 'user@example.com'
  const navItems    = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.athlete

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-card">

      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white" aria-hidden>
            <path d="M6 4h2v16H6V4zm10 0h2v16h-2V4zM3 11h18v2H3v-2z" fill="currentColor" />
          </svg>
        </span>
        <span className="text-base font-bold tracking-tight text-foreground">gym-logs</span>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────── */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Menu
        </p>

        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              {/* Active indicator bar */}
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Icon
                className={cn(
                  'size-4 shrink-0 transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                )}
                aria-hidden
              />
              {label}
            </Link>
          )
        })}

        {/* ── Divider + secondary actions ───────────────────────────── */}
        <div className="mt-auto pt-4">
          <div className="mb-1 h-px bg-border" />
          <Link
            href="/settings"
            className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <Settings className="size-4 shrink-0" aria-hidden />
            Settings
          </Link>
        </div>
      </nav>

      {/* ── User section ─────────────────────────────────────────────── */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2.5">
          <Avatar email={email} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground capitalize">{displayName}</p>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {roleLabel}
            </span>
          </div>
          <button
            type="button"
            aria-label="Sign out"
            onClick={() => logout()}
            disabled={isLoggingOut}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </div>
      </div>

    </aside>
  )
}
