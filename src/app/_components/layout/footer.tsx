import { Suspense } from 'react'
import { StatusWidget } from '@openstatus/react'
import { FooterCitation } from './footer-citation'

const slug = process.env.NEXT_PUBLIC_OPENSTATUS_SLUG
const statusHref = slug ? `https://${slug}.openstatus.dev` : undefined

export function Footer() {
  return (
    <footer className="mx-auto mt-auto flex max-w-4xl flex-col items-center gap-3 px-4 pt-4 pb-6 sm:px-6 lg:px-4">
      <FooterCitation />
      {slug ? (
        <Suspense fallback={null}>
          <StatusWidget slug={slug} href={statusHref} />
        </Suspense>
      ) : null}
    </footer>
  )
}
