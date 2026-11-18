import { Dna } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { commonCopy } from '@/copy/common'

import { authCopy } from '../copy'
import { LoginBackground } from './login-background'

interface LoginFormProps {
  returnTo?: string
  /** Why the last attempt was sent back, if it was. */
  error?: 'passcode' | 'limit'
}

/**
 * The passcode form. A plain form post to /api/login, answered with a
 * redirect (src/server/auth/login.ts), so it works before the page's
 * JavaScript has loaded.
 */
export function LoginForm({ returnTo, error }: LoginFormProps) {
  const hasError = error !== undefined
  const [submitting, setSubmitting] = useState(false)

  return (
    <main
      id="main-content"
      className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-12"
    >
      <LoginBackground />

      {/* Radial vignette: transparent in the middle, background at the edges. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, color-mix(in oklch, var(--background) 35%, transparent) 55%, color-mix(in oklch, var(--background) 80%, transparent) 100%)',
        }}
      />

      <div className="relative z-10 w-full max-w-sm rounded-[min(var(--radius-4xl),24px)] border border-border/50 bg-card/75 p-8 shadow-2xl shadow-black/8 backdrop-blur-2xl">
        {/* The mark, not BrandMark: that one links home, and home is
            behind this page. */}
        <div className="mb-6 flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-spark text-spark-foreground"
          >
            <Dna className="size-4" />
          </span>
          <div className="grid leading-tight">
            <span className="font-display text-base font-semibold tracking-tight">
              {commonCopy.brandName}
            </span>
            <span className="text-xs text-muted-foreground">
              {authCopy.login.tagline}
            </span>
          </div>
        </div>
        <p className="mb-2 type-overline">{authCopy.login.overline}</p>
        <h1 className="type-page-title text-foreground">
          {authCopy.login.title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {authCopy.login.description}
        </p>

        <form
          action="/api/login"
          method="post"
          onSubmit={() => setSubmitting(true)}
          className="mt-8 flex flex-col gap-4"
        >
          {/* For password managers only (`hidden`, so never shown or
              focused); the server reads nothing but the passcode. */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={authCopy.login.passwordManagerUsername}
            readOnly
            hidden
          />
          {returnTo ? (
            <input type="hidden" name="return_to" value={returnTo} />
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{authCopy.login.passcodeLabel}</Label>
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
            {hasError ? (
              <p
                id="login-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {error === 'limit'
                  ? authCopy.login.tooManyAttempts
                  : authCopy.login.wrongPasscode}
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            size="lg"
            className="relative w-full overflow-hidden"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="opacity-0">{authCopy.login.submit}</span>
                <span className="absolute inset-0 flex items-center justify-center">
                  {authCopy.login.submitting}
                </span>
                <span className="login-btn-scan pointer-events-none absolute inset-0" />
              </>
            ) : (
              authCopy.login.submit
            )}
          </Button>
        </form>

        {/* All this page can say without JavaScript: the ?error= message
            above renders only after hydration. Written as markup rather than
            as children because browsers parse a <noscript> body as text when
            scripting is on, which React hydrates as text too. */}
        <noscript
          dangerouslySetInnerHTML={{
            __html: `<p class="mt-4 text-sm leading-relaxed text-muted-foreground">${authCopy.login.noScript}</p>`,
          }}
        />
      </div>
    </main>
  )
}
