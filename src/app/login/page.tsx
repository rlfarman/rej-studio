import { Suspense } from 'react'
import { LoginForm } from '@/features/auth/components/login-form'
import { authCopy } from '@/features/auth/copy'

export const metadata = {
  title: authCopy.login.title,
  robots: { index: false, follow: false },
}

type SearchParams = Promise<{ return_to?: string; error?: string }>

// The URL is request-time data. Reading it inside Suspense lets the page
// shell prerender; the fallback is the same form without return_to/error,
// so nothing shifts when the real one streams in.
export default function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  return (
    <Suspense fallback={<LoginForm />}>
      <LoginFormFromUrl searchParams={searchParams} />
    </Suspense>
  )
}

async function LoginFormFromUrl({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { return_to: returnTo, error } = await searchParams
  return <LoginForm returnTo={returnTo} hasError={error === '1'} />
}
