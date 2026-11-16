'use client' // Error boundaries must be Client Components

import '@/styles/globals.css'
import Link from 'next/link'
import { fontVariableClassName } from '@/styles/fonts'
import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import { appCopy } from '@/copy/app'
import { commonCopy } from '@/copy/common'

/**
 * Last-resort boundary for errors in the root layout itself. It replaces
 * the root layout, so it renders its own <html>/<body> and pulls in the
 * global styles and fonts. The theme provider isn't running here, so it
 * shows the light theme.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  return (
    <html lang="en" className={fontVariableClassName}>
      <body>
        {/* metadata exports aren't supported in global-error */}
        <title>{appCopy.errorBoundary.title}</title>
        <ErrorState
          standalone
          error={error}
          retry={retry}
          boundary="global"
          title={appCopy.errorBoundary.title}
          description={appCopy.errorBoundary.description}
          detail={appCopy.errorBoundary.reassurance}
          secondaryAction={
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/" />}
            >
              {commonCopy.actions.goHome}
            </Button>
          }
        />
      </body>
    </html>
  )
}
