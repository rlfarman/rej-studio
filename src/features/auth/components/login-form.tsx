'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { authCopy } from '@/features/auth/copy'
import { LoginBackground } from '@/features/auth/components/login-background'

type LoginFormProps = {
  returnTo?: string
  hasError?: boolean
}

export function LoginForm({ returnTo, hasError = false }: LoginFormProps) {
  const [submitting, setSubmitting] = useState(false)

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-12">
      {/* Animated DNA helix background */}
      <LoginBackground />

      {/* Radial vignette: transparent center → background at edges */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, color-mix(in oklch, var(--background) 35%, transparent) 55%, color-mix(in oklch, var(--background) 80%, transparent) 100%)',
        }}
      />

      {/* Frosted glass card */}
      <div
        className="border-border/50 bg-card/75 relative z-10 w-full max-w-sm rounded-2xl border p-8 shadow-2xl shadow-black/8 backdrop-blur-2xl"
        style={{ ['--stagger' as string]: 0 }}
      >
        {/* Overline */}
        <p
          className="type-overline text-primary fade-up-stagger mb-6"
          style={{ ['--stagger' as string]: 0 }}
        >
          Private Preview
        </p>

        {/* Title */}
        <h1
          className="type-page-title text-foreground fade-up-stagger"
          style={{ ['--stagger' as string]: 1 }}
        >
          {authCopy.login.title}
        </h1>

        {/* Description */}
        <p
          className="text-muted-foreground fade-up-stagger mt-2 text-sm leading-relaxed"
          style={{ ['--stagger' as string]: 2 }}
        >
          {authCopy.login.description}
        </p>

        <form
          action="/api/login"
          method="post"
          onSubmit={() => setSubmitting(true)}
          className="mt-8 flex flex-col gap-4"
        >
          {returnTo ? (
            <input type="hidden" name="return_to" value={returnTo} />
          ) : null}

          <div
            className="fade-up-stagger flex flex-col gap-2"
            style={{ ['--stagger' as string]: 3 }}
          >
            <Label htmlFor="password">{authCopy.login.passwordLabel}</Label>

            {/* Wrapper provides the drawn-on underline focus indicator */}
            <div className="login-input-wrapper">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                autoFocus
                aria-invalid={hasError || undefined}
                aria-describedby={hasError ? 'login-error' : undefined}
              />
            </div>

            {hasError ? (
              <p
                id="login-error"
                role="alert"
                className="text-destructive text-sm"
              >
                {authCopy.login.error}
              </p>
            ) : null}
          </div>

          <div
            className="fade-up-stagger"
            style={{ ['--stagger' as string]: 4 }}
          >
            <Button
              type="submit"
              className="relative w-full overflow-hidden"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="opacity-0">{authCopy.login.submit}</span>
                  <span className="absolute inset-0 flex items-center justify-center">
                    {authCopy.login.submitting}
                  </span>
                  {/* Scan sweep */}
                  <span className="login-btn-scan pointer-events-none absolute inset-0" />
                </>
              ) : (
                authCopy.login.submit
              )}
            </Button>
          </div>
        </form>
      </div>
    </main>
  )
}
