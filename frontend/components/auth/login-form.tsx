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
import { useI18n } from '@/providers/i18n-provider'
import type { ApiError } from '@/types/api'

export function LoginForm() {
  const { t } = useI18n()
  const a = t.auth

  const loginSchema = z.object({
    email:    z.string().email(a.emailError),
    password: z.string().min(8, a.passwordError),
  })
  type LoginInput = z.infer<typeof loginSchema>

  const [showPassword, setShowPassword] = useState(false)
  const { mutate: login, isPending, error } = useLogin()

  function getErrorMessage(err: AxiosError<ApiError> | null): string | null {
    if (!err) return null
    if (err.response?.status === 401) return a.error401
    if (err.response?.status === 422) return a.error422
    if (!err.response) return a.errorNetwork
    return a.errorGeneric
  }
  const errorMessage = getErrorMessage(error as AxiosError<ApiError> | null)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })

  function onSubmit(data: LoginInput) {
    login(data)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">

        {/* Error alert with forgot-password recovery link */}
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>
              {errorMessage}{' '}
              <Link
                href="/forgot-password"
                className="font-semibold underline underline-offset-4 hover:opacity-80"
              >
                {a.forgotPassword}
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {/* Email */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {a.emailLabel} <span className="text-destructive" aria-hidden>*</span>
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  autoFocus
                  autoComplete="email"
                  placeholder={a.emailPlaceholder}
                  required
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

        {/* Password */}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {a.passwordLabel} <span className="text-destructive" aria-hidden>*</span>
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    {...field}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder={a.passwordPlaceholder}
                    enterKeyHint="go"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? a.hidePassword : a.showPassword}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword
                      ? <EyeOff className="size-4" aria-hidden />
                      : <Eye className="size-4" aria-hidden />}
                  </button>
                </div>
              </FormControl>
              <FormDescription>{a.passwordHint}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={isPending || (form.formState.isSubmitted && !form.formState.isValid)}
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              {a.signingIn}
            </>
          ) : (
            a.submitButton
          )}
        </Button>

        {!errorMessage && (
          <p className="text-center text-sm text-muted-foreground">
            <Link
              href="/forgot-password"
              className="underline underline-offset-4 hover:text-foreground transition-colors"
            >
              {a.forgotPassword}
            </Link>
          </p>
        )}
      </form>
    </Form>
  )
}
