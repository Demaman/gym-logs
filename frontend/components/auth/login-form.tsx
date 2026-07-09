'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { type AxiosError } from 'axios'

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
import { useLogin } from '@/hooks/use-login'
import type { ApiError } from '@/types/api'

const loginSchema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type LoginInput = z.infer<typeof loginSchema>

function getErrorMessage(error: AxiosError<ApiError> | null): string | null {
  if (!error) return null
  if (error.response?.status === 401) return 'Invalid email or password. Please check your credentials.'
  if (error.response?.status === 422) return 'Please check your email and password and try again.'
  if (!error.response) return 'Unable to connect. Check your internet connection and try again.'
  return 'Something went wrong. Please try again.'
}

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const { mutate: login, isPending, error } = useLogin()
  const errorMessage = getErrorMessage(error as AxiosError<ApiError> | null)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    // H5: validate on submit first, then re-validate on change after first attempt
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })

  function onSubmit(data: LoginInput) {
    login(data)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">

        {/* H9: Error alert — includes "Forgot password?" recovery link adjacent to error */}
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>
              {errorMessage}{' '}
              <Link
                href="/forgot-password"
                className="font-semibold underline underline-offset-4 hover:opacity-80"
              >
                Forgot your password?
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {/* Email — H7: autofocus + autocomplete */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Email <span className="text-destructive" aria-hidden>*</span>
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  autoFocus
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  // H5: validate email format on blur (not password — avoid premature errors)
                  onBlur={() => {
                    field.onBlur()
                    if (field.value) form.trigger('email')
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Password — H4: show/hide toggle + H7: autocomplete */}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Password <span className="text-destructive" aria-hidden>*</span>
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    {...field}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    enterKeyHint="go"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword
                      ? <EyeOff className="size-4" aria-hidden />
                      : <Eye className="size-4" aria-hidden />}
                  </button>
                </div>
              </FormControl>
              <FormDescription>Must be at least 8 characters</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* H1: Loading; H5: also disable when form has known errors after first submit */}
        <Button
          type="submit"
          className="w-full"
          disabled={isPending || (form.formState.isSubmitted && !form.formState.isValid)}
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </Button>

        {/* H3 + H10: "Forgot password?" — shown when no auth error (error state includes it inline) */}
        {!errorMessage && (
          <p className="text-center text-sm text-muted-foreground">
            <Link
              href="/forgot-password"
              className="underline underline-offset-4 hover:text-foreground transition-colors"
            >
              Forgot your password?
            </Link>
          </p>
        )}
      </form>
    </Form>
  )
}
