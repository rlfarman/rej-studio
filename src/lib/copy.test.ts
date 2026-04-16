import { describe, expect, it } from 'vitest'
import { appCopy } from './copy'

/**
 * Structural snapshot of the shared copy module.
 * Catches accidental key deletions during refactors.
 */
describe('appCopy', () => {
  it('matches the expected key structure', () => {
    const keys = extractKeys(appCopy)
    expect(keys).toMatchSnapshot()
  })

  it('every leaf is a string or function', () => {
    const leaves = extractLeaves(appCopy)
    for (const { path, value } of leaves) {
      expect(
        typeof value === 'string' || typeof value === 'function',
        `${path} is ${typeof value}, expected string or function`,
      ).toBe(true)
    }
  })
})

// -- helpers --

function extractKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'function') {
      keys.push(`${path}()`)
    } else if (typeof value === 'object' && value !== null) {
      keys.push(...extractKeys(value as Record<string, unknown>, path))
    } else {
      keys.push(path)
    }
  }
  return keys.sort()
}

function extractLeaves(
  obj: Record<string, unknown>,
  prefix = '',
): { path: string; value: unknown }[] {
  const leaves: { path: string; value: unknown }[] = []
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      typeof value !== 'function'
    ) {
      leaves.push(...extractLeaves(value as Record<string, unknown>, path))
    } else {
      leaves.push({ path, value })
    }
  }
  return leaves
}
