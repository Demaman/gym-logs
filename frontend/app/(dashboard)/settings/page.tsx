'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { useI18n } from '@/providers/i18n-provider'
import { useAuthStore } from '@/lib/auth/store'
import { useRole } from '@/hooks/use-role'
import {
  useMyOrganization,
  useUpdateMe,
  useChangePassword,
  useUpdateMyOrganization,
} from '@/hooks/identity/use-settings'
import { useMyTrainer } from '@/hooks/identity/use-memberships'
import { useMyInvites, useAcceptInvite, useDeclineInvite } from '@/hooks/identity/use-invites'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// ── Schemas ───────────────────────────────────────────────────────────────────

const emailSchema = z.object({
  email: z.string().email(),
})

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Required'),
  new_password: z.string().min(8, 'At least 8 characters'),
})

const orgSchema = z.object({
  name: z.string().min(1),
  cnpj: z.string().optional(),
  phone: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
  address_street: z.string().optional(),
  address_city: z.string().optional(),
  address_state: z.string().optional(),
  address_zip: z.string().optional(),
  website: z.string().optional(),
})

type EmailValues = z.infer<typeof emailSchema>
type PasswordValues = z.infer<typeof passwordSchema>
type OrgValues = z.infer<typeof orgSchema>

// ── Section shell ─────────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

// ── Email form ────────────────────────────────────────────────────────────────

function EmailForm() {
  const { t } = useI18n()
  const user = useAuthStore((s) => s.user)
  const { mutate, isPending } = useUpdateMe()
  const [saved, setSaved] = useState(false)

  const form = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: user?.email ?? '' },
  })

  function onSubmit(values: EmailValues) {
    mutate(values, {
      onSuccess: () => {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      },
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.settings.emailLabel} *</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-green-600">{t.settings.emailSaved}</span>}
          <Button type="submit" disabled={isPending || !form.formState.isDirty}>
            {isPending ? t.settings.saving : t.settings.saveEmail}
          </Button>
        </div>
      </form>
    </Form>
  )
}

// ── Password form ─────────────────────────────────────────────────────────────

function PasswordForm() {
  const { t } = useI18n()
  const { mutate, isPending } = useChangePassword()
  const [saved, setSaved] = useState(false)

  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: '', new_password: '' },
  })

  function onSubmit(values: PasswordValues) {
    mutate(values, {
      onSuccess: () => {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
        form.reset()
      },
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="h-px bg-border" />
        <h3 className="text-sm font-semibold text-foreground">{t.settings.changePassword}</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="current_password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.settings.currentPassword} *</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="new_password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.settings.newPassword} *</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-green-600">{t.settings.passwordChanged}</span>}
          <Button type="submit" disabled={isPending || !form.formState.isDirty}>
            {isPending ? t.settings.saving : t.settings.updatePassword}
          </Button>
        </div>
      </form>
    </Form>
  )
}

// ── Org form ──────────────────────────────────────────────────────────────────

function OrgForm() {
  const { t } = useI18n()
  const { data: org, isLoading } = useMyOrganization()
  const { mutate, isPending } = useUpdateMyOrganization()
  const [saved, setSaved] = useState(false)

  const form = useForm<OrgValues>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      name: '',
      cnpj: '',
      phone: '',
      contact_email: '',
      address_street: '',
      address_city: '',
      address_state: '',
      address_zip: '',
      website: '',
    },
  })

  useEffect(() => {
    if (org) {
      form.reset({
        name: org.name,
        cnpj: org.cnpj ?? '',
        phone: org.phone ?? '',
        contact_email: org.contact_email ?? '',
        address_street: org.address_street ?? '',
        address_city: org.address_city ?? '',
        address_state: org.address_state ?? '',
        address_zip: org.address_zip ?? '',
        website: org.website ?? '',
      })
    }
  }, [org, form])

  function onSubmit(values: OrgValues) {
    const payload = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v === '' ? null : v])
    )
    mutate(payload, {
      onSuccess: () => {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      },
    })
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t.common.loading}</p>
  }

  if (!org) {
    return <p className="text-sm text-muted-foreground">{t.settings.noOrg}</p>
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.settings.orgName} *</FormLabel>
              <FormControl>
                <Input placeholder="e.g., CrossFit Downtown" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="cnpj"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.settings.cnpj}</FormLabel>
                <FormControl>
                  <Input placeholder="00.000.000/0001-00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.settings.phone}</FormLabel>
                <FormControl>
                  <Input placeholder="+55 11 99999-9999" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="contact_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.settings.contactEmail}</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="contact@gym.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.settings.website}</FormLabel>
                <FormControl>
                  <Input placeholder="https://gym.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="address_street"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.settings.addressStreet}</FormLabel>
              <FormControl>
                <Input placeholder="123 Main St" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="address_city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.settings.addressCity}</FormLabel>
                <FormControl>
                  <Input placeholder="São Paulo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address_state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.settings.addressState}</FormLabel>
                <FormControl>
                  <Input placeholder="SP" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address_zip"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.settings.addressZip}</FormLabel>
                <FormControl>
                  <Input placeholder="01310-100" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-green-600">{t.settings.orgSaved}</span>}
          <Button type="submit" disabled={isPending || !form.formState.isDirty}>
            {isPending ? t.settings.saving : t.common.save}
          </Button>
        </div>
      </form>
    </Form>
  )
}

// ── Pending invites for athletes ──────────────────────────────────────────────

function PendingInvitesSection() {
  const { t } = useI18n()
  const { data: invites, isLoading } = useMyInvites()
  const accept = useAcceptInvite()
  const decline = useDeclineInvite()

  if (isLoading || !invites?.length) return null

  return (
    <Section title={t.invites.pendingTitle} description={t.invites.pendingDesc}>
      <div className="space-y-3">
        {invites.map((inv) => (
          <div
            key={inv.id}
            className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {inv.organization_name ?? t.invites.unknownGym}
              </p>
              <p className="text-xs text-muted-foreground">
                {t.invites.expires}:{' '}
                {new Date(inv.expires_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={decline.isPending}
                onClick={() => decline.mutate(inv.id)}
              >
                {decline.isPending ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                ) : (
                  t.invites.decline
                )}
              </Button>
              <Button
                size="sm"
                disabled={accept.isPending}
                onClick={() => accept.mutate(inv.id)}
              >
                {accept.isPending ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                ) : (
                  t.invites.accept
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ── Athlete org read-only card ────────────────────────────────────────────────

function AthleteOrgCard() {
  const { t } = useI18n()
  const { data: org, isLoading: orgLoading } = useMyOrganization()
  const { data: trainerMembership, isLoading: trainerLoading } = useMyTrainer()

  if (orgLoading || trainerLoading) {
    return <p className="text-sm text-muted-foreground">{t.common.loading}</p>
  }

  if (!org) return null

  return (
    <dl className="space-y-3">
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t.settings.orgName}
        </dt>
        <dd className="mt-1 text-sm font-medium text-foreground">{org.name}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t.invites.trainer}
        </dt>
        <dd className="mt-1 text-sm font-medium text-foreground">
          {trainerMembership ? trainerMembership.trainer_email : t.invites.noTrainer}
        </dd>
      </div>
    </dl>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { t } = useI18n()
  const role = useRole()
  const user = useAuthStore((s) => s.user)
  const canEditOrg = role === 'trainer' || role === 'gym_admin'
  const isLinkedAthlete = role === 'athlete' && !!user?.organization_id

  return (
    <div className="space-y-8 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t.settings.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.settings.subtitle}</p>
      </div>

      <Section title={t.settings.account} description={t.settings.accountDesc}>
        <EmailForm />
        <div className="mt-6">
          <PasswordForm />
        </div>
      </Section>

      {canEditOrg && (
        <Section title={t.settings.organization} description={t.settings.orgDesc}>
          <OrgForm />
        </Section>
      )}

      {role === 'athlete' && <PendingInvitesSection />}

      {isLinkedAthlete && (
        <Section title={t.settings.organization} description={t.invites.bannerBody}>
          <AthleteOrgCard />
        </Section>
      )}
    </div>
  )
}
