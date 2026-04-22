import { Dna } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { authCopy } from '@/features/auth/copy'

type LoginFormProps = {
  returnTo?: string
  hasError?: boolean
}

const NUCLEOTIDES = 'ATGCU'
const nucleotideGrid = Array.from({ length: 180 }, (_, i) => NUCLEOTIDES[i % 5])

export function LoginForm({ returnTo, hasError = false }: LoginFormProps) {
  return (
    <main className="flex min-h-dvh flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="bg-primary relative flex flex-col overflow-hidden lg:min-h-dvh lg:w-[44%]">
        {/* Nucleotide texture */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden select-none"
          aria-hidden
        >
          <div className="text-primary-foreground grid [grid-template-columns:repeat(15,1fr)] gap-x-1 gap-y-2 p-6 font-mono text-[11px] leading-relaxed tracking-widest opacity-[0.07]">
            {nucleotideGrid.map((letter, i) => (
              <span key={i}>{letter}</span>
            ))}
          </div>
        </div>

        {/* Accent radial glow — bottom-left bloom */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 h-96 w-96 rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(ellipse at bottom left, oklch(0.82 0.2 125 / 0.18) 0%, transparent 70%)',
          }}
          aria-hidden
        />

        {/* Gradient fade at bottom edge for blending on mobile */}
        <div
          className="from-primary pointer-events-none absolute right-0 bottom-0 left-0 h-16 bg-gradient-to-t to-transparent lg:hidden"
          aria-hidden
        />

        <div className="relative z-10 flex flex-1 flex-col justify-between p-8 lg:p-12">
          {/* Wordmark */}
          <div className="flex items-center gap-2.5">
            <Dna className="text-accent size-5" strokeWidth={1.5} />
            <span className="text-primary-foreground/90 font-sans text-sm font-semibold tracking-wide">
              REJ Studio
            </span>
          </div>

          {/* Hero text — hidden on mobile to keep the band compact */}
          <div className="hidden lg:block">
            <h1 className="font-display text-primary-foreground text-5xl leading-[1.1] font-semibold tracking-tight xl:text-6xl">
              Precision
              <br />
              Sequence
              <br />
              <span className="relative inline-block">
                Design
                <span
                  className="bg-accent absolute -bottom-1 left-0 h-[3px] w-full rounded-full opacity-80"
                  aria-hidden
                />
              </span>
            </h1>
            <p className="text-primary-foreground/60 mt-5 max-w-xs text-base leading-relaxed">
              RNA End-Joining optimization for research and clinical
              applications.
            </p>
          </div>

          <p className="text-primary-foreground/30 hidden text-xs lg:block">
            Private preview
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-14 lg:px-16 lg:py-20">
        <div className="w-full max-w-sm">
          <div
            className="fade-up-stagger mb-10"
            style={{ ['--stagger' as string]: 0 }}
          >
            <h2 className="font-display text-foreground text-3xl font-semibold tracking-tight">
              {authCopy.login.title}
            </h2>
            <p className="text-muted-foreground mt-2.5 text-sm leading-relaxed">
              {authCopy.login.description}
            </p>
          </div>

          <form
            action="/api/login"
            method="post"
            className="fade-up-stagger flex flex-col gap-5"
            style={{ ['--stagger' as string]: 1 }}
          >
            {returnTo ? (
              <input type="hidden" name="return_to" value={returnTo} />
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-sm font-medium">
                {authCopy.login.passwordLabel}
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                autoFocus
                className="h-11"
                aria-invalid={hasError || undefined}
                aria-describedby={hasError ? 'login-error' : undefined}
              />
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

            <Button type="submit" className="h-11 w-full text-sm font-medium">
              {authCopy.login.submit}
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
