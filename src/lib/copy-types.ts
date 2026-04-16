/**
 * Branded helper for copy interpolation functions.
 *
 * Usage in a copy module:
 *
 *   import type { CopyFn } from '@/lib/copy-types'
 *
 *   noMatches: ((query: string) => string) satisfies CopyFn<'query'>,
 *
 * The `satisfies` check ensures every copy function conforms to `CopyFn`,
 * while `as const` still narrows the return type to a string literal
 * template. The generic parameter names the argument for documentation —
 * hover over the function in your editor to see `CopyFn<"query">`.
 *
 * For multi-param functions:
 *
 *   seedSuccess: ((favorites: number, recents: number, jobs: number) => string)
 *     satisfies CopyFn<'favorites' | 'recents' | 'jobs'>,
 */

export type CopyFn<K extends string = string> = (...args: never[]) => string
