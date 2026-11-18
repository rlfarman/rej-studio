import { useHydrated } from '@tanstack/react-router'
import type { ComponentType } from 'react'

import { PageLoading } from './page-loading'

/**
 * A route's own pending component (a gene loader, a form skeleton) that
 * renders the shell's PageLoading until the app has hydrated.
 *
 * The prerendered shell has the router's default pending component in the
 * page slot. On a first load the matched route is still pending while the
 * browser hydrates, so a different fallback there would not match the
 * shell's markup and React would discard the tree (error #418). Once
 * hydrated, navigations show the section's own fallback.
 */
export function sectionPending(Fallback: ComponentType) {
  return function SectionPending() {
    return useHydrated() ? <Fallback /> : <PageLoading />
  }
}
