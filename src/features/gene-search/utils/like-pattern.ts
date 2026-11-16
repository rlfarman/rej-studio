/**
 * Escape LIKE wildcards in user input so `%` and `_` match literally.
 * Pair the result with an explicit `ESCAPE '\'` clause: Postgres defaults to
 * backslash, but other dialects (SQLite) have no default escape character.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`)
}
