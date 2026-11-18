import { useState } from 'react'

/**
 * The id of the inline (on-page) search input, so text typed into the
 * prerendered box can be found again while the app hydrates. The palette in
 * the header's dialog doesn't exist before hydration, so it has no id.
 */
export const GENE_SEARCH_INPUT_ID = 'gene-search-input'

/** Whatever is already in the prerendered search box, or ''. */
function preTypedQuery(): string {
  if (typeof document === 'undefined') return ''
  const input = document.getElementById(GENE_SEARCH_INPUT_ID)
  return input instanceof HTMLInputElement ? input.value : ''
}

/**
 * The query the search should start from: what someone has already typed
 * into the prerendered search box, else `defaultQuery`.
 *
 * The home page ships a focused search box in its HTML, so people type into
 * it before the bundle has run. The box is a controlled input once React
 * takes over, and hydration writes the prop back over the DOM — so the
 * typed text used to vanish, with no search for it. Reading the live input
 * in this initializer happens during the hydration render, before React
 * touches the DOM, so the very first state already holds the typed text:
 * nothing is overwritten, and the search runs for it.
 *
 * `enabled` is false for the dialog palette, which must not adopt whatever
 * is sitting in the page's own box.
 */
export function usePreTypedQuery(
  defaultQuery: string | undefined,
  { enabled = true }: { enabled?: boolean } = {},
): string {
  const [initialQuery] = useState(
    () => (enabled ? preTypedQuery() : '') || defaultQuery || '',
  )
  return initialQuery
}
