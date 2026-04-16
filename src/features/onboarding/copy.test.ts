import { describe, expect, it } from 'vitest'
import { onboardingCopy } from './copy'

/**
 * Structural snapshot of the onboarding copy module.
 * Catches accidental key deletions during refactors.
 */
describe('onboardingCopy', () => {
  it('matches the expected key structure', () => {
    const keys = extractKeys(onboardingCopy)
    expect(keys).toMatchSnapshot()
  })

  it('every leaf is a string', () => {
    const leaves = extractLeaves(onboardingCopy)
    for (const { path, value } of leaves) {
      expect(
        typeof value === 'string',
        `${path} is ${typeof value}, expected string`,
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
    } else if (Array.isArray(value)) {
      keys.push(`${path}[]`)
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
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i] as unknown
        if (typeof item === 'object' && item !== null) {
          leaves.push(
            ...extractLeaves(item as Record<string, unknown>, `${path}[${i}]`),
          )
        } else {
          leaves.push({ path: `${path}[${i}]`, value: item })
        }
      }
    } else if (
      typeof value === 'object' &&
      value !== null &&
      typeof value !== 'function'
    ) {
      leaves.push(...extractLeaves(value as Record<string, unknown>, path))
    } else {
      leaves.push({ path, value })
    }
  }
  return leaves
}
