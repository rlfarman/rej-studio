/**
 * The id of a cloud design.
 *
 * A design is deterministic given the request and the optimizer build, so the
 * id is derived from exactly those two things: an identical request finds the
 * instance that already ran it instead of paying for a second run, and a new
 * optimizer build never serves a design the old one made.
 *
 * ## Canonicalisation (pinned: changing any of this changes every id)
 *
 * The hashed text is, in UTF-8:
 *
 *     rej-studio/cloud-design/v1 LF <optimizer .wasm SHA-256, lowercase hex> LF <canonical JSON>
 *
 * where the canonical JSON is the optimizer request (`{ CDS, name, options }`,
 * exactly what `process` is given, including `options.seed` when one was
 * fixed) written as:
 *
 * - objects with their keys sorted by UTF-16 code unit (JavaScript's default
 *   sort), at every depth;
 * - members whose value is `undefined` left out, as `JSON.stringify` does, so
 *   an option that is absent and one that is `undefined` hash the same;
 * - arrays in their own order;
 * - strings and numbers as `JSON.stringify` writes them (numbers in their
 *   shortest round-tripping form), and no whitespace anywhere.
 *
 * The id is the SHA-256 of that text as 64 lowercase hex digits, which fits
 * the Workflow instance id limit (100 characters) and its alphabet.
 *
 * What is deliberately not in it: who submitted the design (two people who
 * ask for the same design share one run; see ./service.ts for what that means
 * for reads and deletes) and when.
 */

const DOMAIN = 'rej-studio/cloud-design/v1'

/** JSON with sorted keys and no `undefined` members; see the module comment. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    // Non-finite numbers have no JSON form; `JSON.stringify` would write
    // null, which would let two different requests share an id.
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new TypeError('canonicalJson: non-finite number')
    }
    const text = JSON.stringify(value)
    if (text === undefined) {
      throw new TypeError(`canonicalJson: ${typeof value} has no JSON form`)
    }
    return text
  }
  if (Array.isArray(value)) {
    // An undefined element is written as null, as JSON.stringify does: an
    // array's positions are part of its meaning.
    return `[${value.map((item) => (item === undefined ? 'null' : canonicalJson(item))).join(',')}]`
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, member]) => member !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([key, member]) => `${JSON.stringify(key)}:${canonicalJson(member)}`).join(',')}}`
}

/** The text that is hashed into an id. Exported for the tests. */
export function cloudDesignIdInput(
  request: unknown,
  optimizerDigest: string,
): string {
  return `${DOMAIN}\n${optimizerDigest.toLowerCase()}\n${canonicalJson(request)}`
}

/** The id of the cloud design for this request on this optimizer build. */
export async function cloudDesignId(
  request: unknown,
  optimizerDigest: string,
): Promise<string> {
  const bytes = new TextEncoder().encode(
    cloudDesignIdInput(request, optimizerDigest),
  )
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}
