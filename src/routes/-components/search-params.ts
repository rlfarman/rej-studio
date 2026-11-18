import { z } from 'zod'

/*
 * Building blocks for the routes' `validateSearch` schemas. The router's
 * codec (search-codec.ts) hands every value over as text, or a list of
 * text for a repeated key, so these coerce types (`?page=2` → 2). Every
 * field `.catch`es: a hand-edited or outdated URL loses the param it got
 * wrong rather than failing the page.
 *
 * Routes call `schema.parse` inside `validateSearch` (rather than passing
 * the schema itself), so links are typed with the parsed output.
 */

/** A non-empty string param (a number or boolean from a link is read as text). */
export const searchText = z
  .union([z.string(), z.number(), z.boolean()])
  .transform(String)
  .pipe(z.string().min(1))
  .optional()
  .catch(undefined)

/** A positive integer param, e.g. a page number. */
export const searchPositiveInt = z.coerce
  .number()
  .int()
  .positive()
  .optional()
  .catch(undefined)

/** One of `values`, or nothing. */
export function searchOneOf<const T extends readonly [string, ...string[]]>(
  values: T,
) {
  return z.enum(values).optional().catch(undefined)
}

/**
 * A list param, kept to `values`. Accepts the router's own array form and a
 * single value (`?i=X-linked`, as older links wrote it); empty is nothing.
 */
export function searchList<const T extends readonly [string, ...string[]]>(
  values: T,
) {
  const allowed = new Set<string>(values)
  return z
    .unknown()
    .transform((value) => {
      const list: unknown[] = Array.isArray(value) ? value : [value]
      const kept = list.filter((v): v is T[number] => allowed.has(v as string))
      return kept.length > 0 ? kept : undefined
    })
    .optional()
}
