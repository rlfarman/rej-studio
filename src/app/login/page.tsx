import { LoginForm } from '@/features/auth/components/login-form'
import { authCopy } from '@/features/auth/copy'

export const metadata = {
  title: authCopy.login.title,
  robots: { index: false, follow: false },
}

type SearchParams = Promise<{ return_to?: string; error?: string }>

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { return_to: returnTo, error } = await searchParams
  return <LoginForm returnTo={returnTo} hasError={error === '1'} />
}
