'use client'

import { useState } from 'react'
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
  LogOut,
  Settings,
  Languages,
  HeartPulse,
  Activity,
  CalendarCheck,
  ChevronDown,
  Swords,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/auth/store'
import { useLogout } from '@/hooks/use-logout'
import { useI18n } from '@/providers/i18n-provider'
import { InviteBellBadge } from '@/components/layout/invite-banner'
import type { Locale } from '@/lib/i18n'
import type { Role } from '@/hooks/use-role'

// ── Nav types ─────────────────────────────────────────────────────────────────

type NavKey = keyof ReturnType<typeof useI18n>['t']['nav']

type NavItem = {
  kind?: 'item'
  href: string
  labelKey: NavKey
  icon: React.ElementType
}

type NavGroup = {
  kind: 'group'
  labelKey: NavKey
  icon: React.ElementType
  children: NavItem[]
}

type NavEntry = NavItem | NavGroup

// ── Nav items per role ────────────────────────────────────────────────────────

const NAV_BY_ROLE: Record<Role, NavEntry[]> = {
  athlete: [
    { href: '/logs',          labelKey: 'logs',          icon: Dumbbell   },
    { href: '/training',      labelKey: 'training',      icon: BookOpen   },
    { href: '/health',        labelKey: 'health',        icon: HeartPulse },
    { href: '/analytics',     labelKey: 'analytics',     icon: TrendingUp },
    { href: '/logs/battles',  labelKey: 'battleHistory', icon: Swords     },
  ],
  trainer: [
    { href: '/overview',       labelKey: 'overview',     icon: LayoutDashboard },
    { href: '/logs',           labelKey: 'logs',         icon: ClipboardList   },
    { href: '/athletes',       labelKey: 'athletes',     icon: Users           },
    { href: '/member-health',  labelKey: 'memberHealth', icon: Activity        },
    { href: '/training',       labelKey: 'programs',     icon: BookOpen        },
    { href: '/analytics',      labelKey: 'analytics',    icon: TrendingUp      },
  ],
  gym_admin: [
    { href: '/overview',      labelKey: 'overview',     icon: LayoutDashboard },
    { href: '/trainers',      labelKey: 'trainers',     icon: UserCheck       },
    { href: '/athletes',      labelKey: 'athletes',     icon: Users           },
    { href: '/member-health', labelKey: 'memberHealth', icon: Activity        },
    { href: '/attendance',    labelKey: 'attendance',   icon: CalendarCheck   },
    { href: '/training',      labelKey: 'training',     icon: BookOpen        },
    { href: '/analytics',     labelKey: 'analytics',    icon: TrendingUp      },
  ],
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

// ── Language switcher ─────────────────────────────────────────────────────────

function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()

  function toggle() {
    const next: Locale = locale === 'en' ? 'pt-BR' : 'en'
    setLocale(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={t.language.label}
      className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
    >
      <Languages className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 text-left">{locale === 'en' ? t.language.en : t.language.ptBR}</span>
    </button>
  )
}

// ── Nav group (collapsible) ───────────────────────────────────────────────────

function NavGroupItem({
  group,
  pathname,
  t,
}: {
  group: NavGroup
  pathname: string
  t: ReturnType<typeof useI18n>['t']
}) {
  const anyChildActive = group.children.some(
    (c) => pathname === c.href || pathname.startsWith(c.href + '/'),
  )
  const [open, setOpen] = useState(anyChildActive)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'group relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150',
          anyChildActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        )}
      >
        {anyChildActive && (
          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
        )}
        <group.icon
          className={cn(
            'size-4 shrink-0 transition-colors',
            anyChildActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
          )}
          aria-hidden
        />
        <span className="flex-1 text-left">{t.nav[group.labelKey]}</span>
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 transition-transform duration-200',
            open ? 'rotate-180' : '',
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-3">
          {group.children.map(({ href, labelKey, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex h-9 items-center gap-2.5 rounded-lg px-2 text-sm font-medium transition-colors duration-150',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )}
              >
                <Icon
                  className={cn(
                    'size-3.5 shrink-0',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                  aria-hidden
                />
                {t.nav[labelKey]}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const { mutate: logout, isPending: isLoggingOut } = useLogout()
  const { t } = useI18n()

  const displayName = user?.email.split('@')[0] ?? 'User'
  const role        = (user?.role ?? 'athlete') as Role
  const roleLabel   = t.roles[role] ?? t.roles.athlete
  const email       = user?.email ?? 'user@example.com'
  const navEntries  = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.athlete
  const homeHref    = role === 'athlete' ? '/logs' : '/overview'

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-card">

      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <Link
        href={homeHref}
        className="flex h-16 items-center gap-2.5 border-b border-border px-5 transition-opacity hover:opacity-80"
        aria-label="gym-logs home"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white" aria-hidden>
            <path d="M6 4h2v16H6V4zm10 0h2v16h-2V4zM3 11h18v2H3v-2z" fill="currentColor" />
          </svg>
        </span>
        <span className="text-base font-bold tracking-tight text-foreground">gym-logs</span>
      </Link>

      {/* ── Navigation ───────────────────────────────────────────────── */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          {t.nav.menu}
        </p>

        {navEntries.map((entry) => {
          if (entry.kind === 'group') {
            return (
              <NavGroupItem
                key={entry.labelKey}
                group={entry}
                pathname={pathname}
                t={t}
              />
            )
          }
          const { href, labelKey, icon: Icon } = entry
          const active = pathname === href || pathname.startsWith(href + '/')
          const label = t.nav[labelKey]
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
          <LanguageSwitcher />
          <Link
            href="/settings"
            className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <Settings className="size-4 shrink-0" aria-hidden />
            {t.nav.settings}
            <InviteBellBadge />
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
