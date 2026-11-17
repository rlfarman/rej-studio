// @vitest-environment node
import { describe, expect, it } from 'vite-plus/test'

import { canonicalJson, cloudDesignId, cloudDesignIdInput } from './id'

const DIGEST = 'a'.repeat(64)
const OTHER_DIGEST = 'b'.repeat(64)

const REQUEST = {
  CDS: 'ATGAAATAA',
  name: 'TP53 cloud',
  options: {
    codon_optimize: 'human',
    split_point: 4,
    selected_wggw_site: null,
    ensure_wggw: true,
    wggw_threshold: 300,
  },
}

describe('canonicalJson', () => {
  it('sorts keys at every depth and writes no whitespace', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, 1], c: 'x' } })).toBe(
      '{"a":{"c":"x","d":[3,1]},"b":1}',
    )
  })

  it('leaves out undefined members, as JSON.stringify does', () => {
    expect(canonicalJson({ a: 1, seed: undefined })).toBe(
      canonicalJson({ a: 1 }),
    )
  })

  it('keeps null, which is a value, not an absence', () => {
    expect(canonicalJson({ a: null })).toBe('{"a":null}')
    expect(canonicalJson({ a: null })).not.toBe(canonicalJson({}))
  })

  it('keeps array order and writes an undefined element as null', () => {
    expect(canonicalJson([2, undefined, 1])).toBe('[2,null,1]')
  })

  it('escapes strings and keys the way JSON.stringify does', () => {
    expect(canonicalJson({ 'k"\n': 'é" ' })).toBe(
      `{${JSON.stringify('k"\n')}:${JSON.stringify('é" ')}}`,
    )
  })

  it('refuses values with no JSON form instead of hashing them as null', () => {
    expect(() => canonicalJson({ a: Number.NaN })).toThrow(TypeError)
    expect(() => canonicalJson({ a: Infinity })).toThrow(TypeError)
    expect(() => canonicalJson(() => 1)).toThrow(TypeError)
  })
})

describe('cloudDesignId', () => {
  it('is 64 lowercase hex digits', async () => {
    expect(await cloudDesignId(REQUEST, DIGEST)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is pinned: this request and digest always give this id', async () => {
    // If this changes, every cloud design id changes with it, and designs
    // already submitted can no longer be found by resubmitting them.
    expect(cloudDesignIdInput(REQUEST, DIGEST)).toBe(
      `rej-studio/cloud-design/v1\n${DIGEST}\n` +
        '{"CDS":"ATGAAATAA","name":"TP53 cloud","options":{"codon_optimize":"human","ensure_wggw":true,"selected_wggw_site":null,"split_point":4,"wggw_threshold":300}}',
    )
    expect(await cloudDesignId(REQUEST, DIGEST)).toBe(
      await sha256Hex(cloudDesignIdInput(REQUEST, DIGEST)),
    )
  })

  it('does not depend on key order', async () => {
    const reordered = {
      options: Object.fromEntries(Object.entries(REQUEST.options).reverse()),
      name: REQUEST.name,
      CDS: REQUEST.CDS,
    }
    expect(await cloudDesignId(reordered, DIGEST)).toBe(
      await cloudDesignId(REQUEST, DIGEST),
    )
  })

  it('treats the digest case-insensitively', async () => {
    expect(await cloudDesignId(REQUEST, DIGEST.toUpperCase())).toBe(
      await cloudDesignId(REQUEST, DIGEST),
    )
  })

  it.each([
    ['the sequence', { ...REQUEST, CDS: 'ATGAAGTAA' }],
    ['the name', { ...REQUEST, name: 'TP53 again' }],
    [
      'an option',
      { ...REQUEST, options: { ...REQUEST.options, split_point: 5 } },
    ],
    ['a fixed seed', { ...REQUEST, options: { ...REQUEST.options, seed: 1 } }],
  ])('changes with %s', async (_, changed) => {
    expect(await cloudDesignId(changed, DIGEST)).not.toBe(
      await cloudDesignId(REQUEST, DIGEST),
    )
  })

  it('changes with the optimizer build', async () => {
    expect(await cloudDesignId(REQUEST, OTHER_DIGEST)).not.toBe(
      await cloudDesignId(REQUEST, DIGEST),
    )
  })
})

async function sha256Hex(text: string): Promise<string> {
  const { createHash } = await import('node:crypto')
  return createHash('sha256').update(text, 'utf8').digest('hex')
}
