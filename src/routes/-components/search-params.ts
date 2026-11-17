/**
 * Keeps a raw search param only if it is a non-empty string, so a
 * hand-edited URL (`?species=1`, `?job=`) is dropped rather than typed wrong.
 */
export function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}
