'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, Dumbbell, Users, Building2, CheckCircle2, Check, Building } from 'lucide-react'
import Link from 'next/link'
import { type AxiosError } from 'axios'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { register as registerApi } from '@/lib/api/auth'
import { createOrganization, getOrgByJoinCode } from '@/lib/api/identity'
import type { ApiError, OrgLookup, User } from '@/types/api'
import { useI18n } from '@/providers/i18n-provider'

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = 'athlete' | 'trainer' | 'gym_admin'
type OrgMode = 'none' | 'create' | 'join'
type Step = 1 | 2

interface RoleOption {
  role: Role
  label: string
  description: string
  icon: React.ElementType
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLES: RoleOption[] = [
  {
    role: 'athlete',
    label: 'Athlete',
    description: 'I log my workouts and track my progress',
    icon: Dumbbell,
  },
  {
    role: 'trainer',
    label: 'Trainer',
    description: 'I coach athletes and build training programs',
    icon: Users,
  },
  {
    role: 'gym_admin',
    label: 'Gym / Organization',
    description: 'I manage a gym and its members',
    icon: Building2,
  },
]

const JOIN_CODE_RE = /^[A-Z0-9]{6}$/i

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z
  .object({
    email:            z.string().email('Enter a valid email address'),
    password:         z.string().min(8, 'Must be at least 8 characters'),
    confirm_password: z.string().min(1, 'Please confirm your password'),
    join_code:        z.string().optional(),
    org_name:         z.string().optional(),
    cnpj:             z.string().optional(),
    phone:            z.string().optional(),
    contact_email:    z.string().optional(),
    address_street:   z.string().optional(),
    address_city:     z.string().optional(),
    address_state:    z.string().optional(),
    address_zip:      z.string().optional(),
    website:          z.string().optional(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

type FormInput = z.infer<typeof schema>

// ── Helpers ───────────────────────────────────────────────────────────────────

function getErrorMessage(error: AxiosError<ApiError> | unknown): string | null {
  const err = error as AxiosError<ApiError>
  if (!err?.response) return 'Unable to connect. Check your internet connection and try again.'
  if (err.response.status === 409) return 'An account with this email already exists.'
  if (err.response.status === 422) return 'Please check your details and try again.'
  return 'Something went wrong. Please try again.'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2">
      {([1, 2] as Step[]).map((s) => (
        <div
          key={s}
          className={cn(
            'h-1.5 rounded-full transition-all duration-200',
            s === step ? 'w-6 bg-primary' : s < step ? 'w-6 bg-primary/40' : 'w-3 bg-border',
          )}
          aria-hidden
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">Step {step} of 2</span>
    </div>
  )
}

function RoleCard({ option, selected, onSelect }: { option: RoleOption; selected: boolean; onSelect: () => void }) {
  const Icon = option.icon
  return (
    <button
      type="button"
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
      role="radio"
      aria-checked={selected}
      className={cn(
        'relative flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-all duration-150',
        'hover:border-primary/50 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-primary bg-accent/40 shadow-sm' : 'border-border bg-card',
      )}
    >
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors', selected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="flex flex-col gap-0.5 pt-0.5">
        <span className={cn('text-sm font-semibold', selected && 'text-primary')}>{option.label}</span>
        <span className="text-xs text-muted-foreground leading-relaxed">{option.description}</span>
      </span>
      {selected && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
          <Check className="size-3 text-primary-foreground" aria-hidden />
        </span>
      )}
    </button>
  )
}

function PasswordInput({ value, onChange, onBlur, name, autoComplete, placeholder = '••••••••', enterKeyHint }: {
  value: string; onChange: React.ChangeEventHandler<HTMLInputElement>; onBlur?: React.FocusEventHandler<HTMLInputElement>
  name: string; autoComplete: string; placeholder?: string; enterKeyHint?: React.InputHTMLAttributes<HTMLInputElement>['enterKeyHint']
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input name={name} value={value} onChange={onChange} onBlur={onBlur} type={show ? 'text' : 'password'} autoComplete={autoComplete} placeholder={placeholder} enterKeyHint={enterKeyHint} required className="pr-10" />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground">
        {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  )
}

// ── Join code field with live gym preview ─────────────────────────────────────

function JoinCodeField({
  form,
  gymLookup,
  gymLookupError,
  isLookingUp,
  onCodeChange,
  t,
}: {
  form: ReturnType<typeof useForm<FormInput>>
  gymLookup: OrgLookup | null
  gymLookupError: string | null
  isLookingUp: boolean
  onCodeChange: (v: string) => void
  t: ReturnType<typeof useI18n>['t']
}) {
  return (
    <FormField
      control={form.control}
      name="join_code"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t.auth.joinCodeLabel} <span className="text-destructive" aria-hidden>*</span></FormLabel>
          <FormControl>
            <Input
              {...field}
              autoFocus
              placeholder={t.auth.joinCodePlaceholder}
              spellCheck={false}
              maxLength={6}
              className="font-mono tracking-widest uppercase"
              value={field.value?.toUpperCase() ?? ''}
              onChange={(e) => onCodeChange(e.target.value)}
            />
          </FormControl>
          <FormDescription>{t.auth.joinCodeHint}</FormDescription>
          {isLookingUp && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              {t.auth.lookingUpGym}
            </p>
          )}
          {gymLookup && !isLookingUp && (
            <p className="flex items-center gap-1.5 text-xs text-green-600">
              <Building className="size-3" aria-hidden />
              {t.auth.gymFound} <span className="font-semibold">{gymLookup.name}</span>
            </p>
          )}
          {gymLookupError && !isLookingUp && (
            <p className="text-xs text-destructive">{gymLookupError}</p>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

// ── Org creation form fields ──────────────────────────────────────────────────

function OrgFields({ form, required }: { form: ReturnType<typeof useForm<FormInput>>; required: boolean }) {
  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="org_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Organization name{required && <span className="text-destructive" aria-hidden> *</span>}
            </FormLabel>
            <FormControl>
              <Input {...field} placeholder="e.g. Iron Works Gym" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="cnpj"
          render={({ field }) => (
            <FormItem>
              <FormLabel>CNPJ</FormLabel>
              <FormControl>
                <Input {...field} placeholder="00.000.000/0001-00" />
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
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input {...field} type="tel" placeholder="+55 11 9 0000-0000" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="contact_email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Contact email</FormLabel>
            <FormControl>
              <Input {...field} type="email" placeholder="contact@mygym.com" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="address_street"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Address</FormLabel>
            <FormControl>
              <Input {...field} placeholder="Rua das Flores, 123" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-3 gap-3">
        <FormField
          control={form.control}
          name="address_city"
          render={({ field }) => (
            <FormItem className="col-span-1">
              <FormLabel>City</FormLabel>
              <FormControl><Input {...field} placeholder="São Paulo" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address_state"
          render={({ field }) => (
            <FormItem>
              <FormLabel>State</FormLabel>
              <FormControl><Input {...field} placeholder="SP" maxLength={2} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address_zip"
          render={({ field }) => (
            <FormItem>
              <FormLabel>CEP</FormLabel>
              <FormControl><Input {...field} placeholder="01310-100" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="website"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Website</FormLabel>
            <FormControl>
              <Input {...field} type="url" placeholder="https://mygym.com" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function RegisterForm() {
  const { t } = useI18n()
  const [step, setStep] = useState<Step>(1)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [orgMode, setOrgMode] = useState<OrgMode>('none')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [registeredUser, setRegisteredUser] = useState<User | null>(null)

  // Join code lookup state
  const [gymLookup, setGymLookup] = useState<OrgLookup | null>(null)
  const [gymLookupError, setGymLookupError] = useState<string | null>(null)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const form = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '', password: '', confirm_password: '', join_code: '',
      org_name: '', cnpj: '', phone: '', contact_email: '',
      address_street: '', address_city: '', address_state: '', address_zip: '', website: '',
    },
    mode: 'onTouched',
    reValidateMode: 'onChange',
  })

  const shouldCreateOrg = selectedRole === 'gym_admin' || (selectedRole === 'trainer' && orgMode === 'create')

  function handleJoinCodeChange(value: string) {
    const code = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    form.setValue('join_code', code)
    setGymLookup(null)
    setGymLookupError(null)
    if (lookupTimer.current) clearTimeout(lookupTimer.current)
    if (JOIN_CODE_RE.test(code)) {
      setIsLookingUp(true)
      lookupTimer.current = setTimeout(async () => {
        try {
          const org = await getOrgByJoinCode(code)
          setGymLookup(org)
          setGymLookupError(null)
        } catch {
          setGymLookupError(t.auth.gymNotFound)
        } finally {
          setIsLookingUp(false)
        }
      }, 400)
    }
  }

  async function onSubmit(values: FormInput) {
    if (!selectedRole) return

    if (shouldCreateOrg && !values.org_name?.trim()) {
      form.setError('org_name', { message: 'Organization name is required' })
      return
    }

    // Block if join code entered but not yet resolved
    if (orgMode === 'join' && values.join_code && !gymLookup) {
      form.setError('join_code', { message: gymLookupError ?? t.auth.gymNotFound })
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      let orgId: string | undefined
      let joinCode: string | undefined

      if (shouldCreateOrg) {
        const org = await createOrganization({
          name: values.org_name!.trim(),
          cnpj: values.cnpj || null,
          phone: values.phone || null,
          contact_email: values.contact_email || null,
          address_street: values.address_street || null,
          address_city: values.address_city || null,
          address_state: values.address_state || null,
          address_zip: values.address_zip || null,
          website: values.website || null,
        })
        orgId = String(org.id)
      } else if (orgMode === 'join' && values.join_code) {
        joinCode = values.join_code
      }

      const user = await registerApi({
        email: values.email,
        password: values.password,
        role: selectedRole,
        organization_id: orgId,
        join_code: joinCode,
      })
      setRegisteredUser(user)
      setIsSuccess(true)
    } catch (err) {
      setSubmitError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Success ───────────────────────────────────────────────────────────────

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--success)]/10">
          <CheckCircle2 className="size-7 text-[color:var(--success)]" aria-hidden />
        </span>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold tracking-tight">Account created!</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Welcome to gym-logs,{' '}
            <span className="font-medium text-foreground">{registeredUser?.email}</span>.
            <br />Sign in to get started.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/login">Sign in to your account</Link>
        </Button>
      </div>
    )
  }

  // ── Step 1: Role selection ────────────────────────────────────────────────

  if (step === 1) {
    return (
      <div className="flex flex-col gap-6">
        <StepIndicator step={1} />
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight">Who are you?</h1>
          <p className="text-sm text-muted-foreground">Choose the option that best describes you.</p>
        </div>
        <div className="flex flex-col gap-3" role="radiogroup" aria-label="Select your role">
          {ROLES.map((opt) => (
            <RoleCard key={opt.role} option={opt} selected={selectedRole === opt.role} onSelect={() => setSelectedRole(opt.role)} />
          ))}
        </div>
        <Button className="w-full" disabled={!selectedRole} onClick={() => setStep(2)}>
          Continue
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary underline underline-offset-4 hover:opacity-80 transition-opacity">Sign in</Link>
        </p>
      </div>
    )
  }

  // ── Step 2: Account + org details ─────────────────────────────────────────

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <StepIndicator step={2} />

        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            Signing up as{' '}
            <span className="font-medium text-foreground">{ROLES.find((r) => r.role === selectedRole)?.label}</span>
          </p>
        </div>

        {submitError && (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        {/* Email */}
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>Email <span className="text-destructive" aria-hidden>*</span></FormLabel>
            <FormControl>
              <Input {...field} type="email" autoFocus autoComplete="email" placeholder="you@example.com" required />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* Password */}
        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem>
            <FormLabel>Password <span className="text-destructive" aria-hidden>*</span></FormLabel>
            <FormControl>
              <PasswordInput {...field} autoComplete="new-password" enterKeyHint="next"
                onChange={(e) => { field.onChange(e); if (form.getValues('confirm_password')) form.trigger('confirm_password') }}
              />
            </FormControl>
            <FormDescription>Must be at least 8 characters</FormDescription>
            <FormMessage />
          </FormItem>
        )} />

        {/* Confirm password */}
        <FormField control={form.control} name="confirm_password" render={({ field }) => (
          <FormItem>
            <FormLabel>Confirm password <span className="text-destructive" aria-hidden>*</span></FormLabel>
            <FormControl>
              <PasswordInput {...field} autoComplete="new-password" placeholder="••••••••" enterKeyHint="go" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* ── gym_admin: always creates an org ─── */}
        {selectedRole === 'gym_admin' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your organization</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <p className="text-xs text-muted-foreground">Only the name is required. All other fields are optional.</p>
            <OrgFields form={form} required />
          </div>
        )}

        {/* ── trainer: pick org mode ─── */}
        {selectedRole === 'trainer' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Organization</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="flex flex-col gap-2">
              {([
                { mode: 'none' as OrgMode,   label: 'I work independently' },
                { mode: 'create' as OrgMode, label: 'Create my organization' },
                { mode: 'join' as OrgMode,   label: t.auth.joinExistingGym },
              ]).map(({ mode, label }) => (
                <label key={mode} className="flex cursor-pointer items-center gap-3 select-none">
                  <input
                    type="radio"
                    name="orgMode"
                    checked={orgMode === mode}
                    onChange={() => { setOrgMode(mode); setGymLookup(null); setGymLookupError(null) }}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm font-medium">{label}</span>
                </label>
              ))}
            </div>

            {orgMode === 'create' && (
              <div className="space-y-4 pt-1">
                <p className="text-xs text-muted-foreground">Only the name is required. All other fields are optional.</p>
                <OrgFields form={form} required />
              </div>
            )}

            {orgMode === 'join' && (
              <JoinCodeField
                form={form}
                gymLookup={gymLookup}
                gymLookupError={gymLookupError}
                isLookingUp={isLookingUp}
                onCodeChange={handleJoinCodeChange}
                t={t}
              />
            )}
          </div>
        )}

        {/* ── athlete: optionally join an org ─── */}
        {selectedRole === 'athlete' && (
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center gap-3 select-none">
              <input
                type="checkbox"
                checked={orgMode === 'join'}
                onChange={(e) => {
                  setOrgMode(e.target.checked ? 'join' : 'none')
                  if (!e.target.checked) { form.setValue('join_code', ''); setGymLookup(null); setGymLookupError(null) }
                }}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-sm font-medium text-foreground">{t.auth.belongToGym}</span>
            </label>

            {orgMode === 'join' && (
              <JoinCodeField
                form={form}
                gymLookup={gymLookup}
                gymLookupError={gymLookupError}
                isLookingUp={isLookingUp}
                onCodeChange={handleJoinCodeChange}
                t={t}
              />
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-1">
          <Button type="submit" className="w-full" disabled={isSubmitting || (form.formState.isSubmitted && !form.formState.isValid)}>
            {isSubmitting ? (
              <><Loader2 className="animate-spin" aria-hidden />Creating account…</>
            ) : (
              'Create account'
            )}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setStep(1)}>
            ← Back
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary underline underline-offset-4 hover:opacity-80 transition-opacity">Sign in</Link>
        </p>
      </form>
    </Form>
  )
}
