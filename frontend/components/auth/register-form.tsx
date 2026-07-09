'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, Dumbbell, Users, Building2, CheckCircle2, Check } from 'lucide-react'
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
import { useRegister } from '@/hooks/use-register'
import type { ApiError } from '@/types/api'

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = 'athlete' | 'trainer' | 'gym_admin'
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Validation ────────────────────────────────────────────────────────────────

const accountSchema = z
  .object({
    email:            z.string().email('Enter a valid email address'),
    password:         z.string().min(8, 'Must be at least 8 characters'),
    confirm_password: z.string().min(1, 'Please confirm your password'),
    organization_id:  z.string().optional(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

type AccountInput = z.infer<typeof accountSchema>

// ── Error helpers ─────────────────────────────────────────────────────────────

function getErrorMessage(error: AxiosError<ApiError> | null): string | null {
  if (!error) return null
  if (error.response?.status === 409) return 'An account with this email already exists.'
  if (error.response?.status === 422) return 'Please check your details and try again.'
  if (!error.response) return 'Unable to connect. Check your internet connection and try again.'
  return 'Something went wrong. Please try again.'
}

// ── Step indicator ────────────────────────────────────────────────────────────

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

// ── Role card ─────────────────────────────────────────────────────────────────

function RoleCard({
  option,
  selected,
  onSelect,
}: {
  option: RoleOption
  selected: boolean
  onSelect: () => void
}) {
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
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
          selected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="flex flex-col gap-0.5 pt-0.5">
        <span className={cn('text-sm font-semibold', selected && 'text-primary')}>
          {option.label}
        </span>
        <span className="text-xs text-muted-foreground leading-relaxed">
          {option.description}
        </span>
      </span>
      {selected && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
          <Check className="size-3 text-primary-foreground" aria-hidden />
        </span>
      )}
    </button>
  )
}

// ── Password input with show/hide toggle ──────────────────────────────────────

function PasswordInput({
  value,
  onChange,
  onBlur,
  name,
  autoComplete,
  placeholder = '••••••••',
  enterKeyHint,
}: {
  value: string
  onChange: React.ChangeEventHandler<HTMLInputElement>
  onBlur?: React.FocusEventHandler<HTMLInputElement>
  name: string
  autoComplete: string
  placeholder?: string
  enterKeyHint?: React.InputHTMLAttributes<HTMLInputElement>['enterKeyHint']
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        enterKeyHint={enterKeyHint}
        required
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
      >
        {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function RegisterForm() {
  const [step, setStep] = useState<Step>(1)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [hasOrg, setHasOrg] = useState(false)

  const { mutate: doRegister, isPending, error, isSuccess, data: registeredUser } = useRegister()
  const errorMessage = getErrorMessage(error as AxiosError<ApiError> | null)

  const form = useForm<AccountInput>({
    resolver: zodResolver(accountSchema),
    defaultValues: { email: '', password: '', confirm_password: '', organization_id: '' },
    mode: 'onTouched',
    reValidateMode: 'onChange',
  })

  // Re-validate confirm_password whenever password changes so the match error stays live
  const password = form.watch('password')

  function onSubmit(values: AccountInput) {
    if (!selectedRole) return
    doRegister({
      email: values.email,
      password: values.password,
      role: selectedRole,
      organization_id: hasOrg && values.organization_id ? values.organization_id : undefined,
    })
  }

  // ── Success state ─────────────────────────────────────────────────────────

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
            <RoleCard
              key={opt.role}
              option={opt}
              selected={selectedRole === opt.role}
              onSelect={() => setSelectedRole(opt.role)}
            />
          ))}
        </div>
        <Button className="w-full" disabled={!selectedRole} onClick={() => setStep(2)}>
          Continue
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary underline underline-offset-4 hover:opacity-80 transition-opacity">
            Sign in
          </Link>
        </p>
      </div>
    )
  }

  // ── Step 2: Account details ───────────────────────────────────────────────

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <StepIndicator step={2} />

        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            Signing up as{' '}
            <span className="font-medium text-foreground">
              {ROLES.find((r) => r.role === selectedRole)?.label}
            </span>
          </p>
        </div>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Email */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email <span className="text-destructive" aria-hidden>*</span></FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  autoFocus
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Password */}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password <span className="text-destructive" aria-hidden>*</span></FormLabel>
              <FormControl>
                <PasswordInput
                  {...field}
                  autoComplete="new-password"
                  enterKeyHint="next"
                  // Re-validate confirm field live when password changes
                  onChange={(e) => {
                    field.onChange(e)
                    if (form.getValues('confirm_password')) {
                      form.trigger('confirm_password')
                    }
                  }}
                />
              </FormControl>
              <FormDescription>Must be at least 8 characters</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Confirm password */}
        <FormField
          control={form.control}
          name="confirm_password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm password <span className="text-destructive" aria-hidden>*</span></FormLabel>
              <FormControl>
                <PasswordInput
                  {...field}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  enterKeyHint={hasOrg ? 'next' : 'go'}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Organization toggle + field */}
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-3 select-none">
            <input
              type="checkbox"
              checked={hasOrg}
              onChange={(e) => {
                setHasOrg(e.target.checked)
                if (!e.target.checked) form.setValue('organization_id', '')
              }}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm font-medium text-foreground">I have an organization code</span>
          </label>

          {hasOrg && (
            <FormField
              control={form.control}
              name="organization_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization ID</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoFocus
                      placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                      spellCheck={false}
                      onChange={(e) => {
                        field.onChange(e)
                        const v = e.target.value
                        if (v && !UUID_RE.test(v)) {
                          form.setError('organization_id', {
                            message: "Check with your gym admin — that doesn't look like a valid ID",
                          })
                        } else {
                          form.clearErrors('organization_id')
                        }
                      }}
                    />
                  </FormControl>
                  <FormDescription>Get this code from your gym administrator</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-1">
          <Button
            type="submit"
            className="w-full"
            disabled={isPending || (form.formState.isSubmitted && !form.formState.isValid)}
          >
            {isPending ? (
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
          <Link href="/login" className="font-medium text-primary underline underline-offset-4 hover:opacity-80 transition-opacity">
            Sign in
          </Link>
        </p>
      </form>
    </Form>
  )
}
