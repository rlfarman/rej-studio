import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { authCopy } from '@/features/auth/copy'

type LoginFormProps = {
  returnTo?: string
  hasError?: boolean
}

export function LoginForm({ returnTo, hasError = false }: LoginFormProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          {authCopy.login.title}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {authCopy.login.description}
        </p>
        <form
          action="/api/login"
          method="post"
          className="mt-8 flex flex-col gap-4"
        >
          {returnTo ? (
            <input type="hidden" name="return_to" value={returnTo} />
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{authCopy.login.passwordLabel}</Label>
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
                className="text-destructive text-sm"
              >
                {authCopy.login.error}
              </p>
            ) : null}
          </div>
          <Button type="submit" className="w-full">
            {authCopy.login.submit}
          </Button>
        </form>
      </div>
    </main>
  )
}
