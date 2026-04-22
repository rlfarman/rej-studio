import { Suspense } from 'react'
import { LoginForm } from '@/features/auth/components/login-form'
import { authCopy } from '@/features/auth/copy'

export const metadata = {
  title: authCopy.login.title,
  robots: { index: false, follow: false },
}

type SearchParams = Promise<{ return_to?: string; error?: string }>

// Params read in a Suspense-wrapped child so the static shell prerenders under
// Next 16 cacheComponents. See docs/architecture for the house convention.
async function LoginFormWithParams({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { return_to: returnTo, error } = await searchParams
  return <LoginForm returnTo={returnTo} hasError={error === '1'} />
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  return (
    <Suspense fallback={<LoginForm />}>
      <LoginFormWithParams searchParams={searchParams} />
    </Suspense>
  )
}
