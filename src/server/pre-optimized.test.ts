import { describe, expect, it, vi } from 'vite-plus/test'

import { handlePreOptimizedZip } from './pre-optimized'

const ID = 'ENST00000269305'
const BUCKET_URL = `https://rej-seq-1.s3.us-west-004.backblazeb2.com/rej/v1.0/zips/${ID}_v1.0.zip`

/** A fetch that answers every request with `response`, and its spy. */
function upstream(response: () => Response | Promise<Response>) {
  return vi.fn<typeof fetch>(async () => response())
}

describe('handlePreOptimizedZip', () => {
  it('streams the package back as a same-origin ZIP attachment', async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    const fetchUpstream = upstream(
      () =>
        new Response(bytes, {
          headers: {
            'content-type': 'binary/octet-stream',
            'content-length': String(bytes.length),
          },
        }),
    )

    const response = await handlePreOptimizedZip(ID, fetchUpstream)

    expect(fetchUpstream).toHaveBeenCalledWith(BUCKET_URL)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/zip')
    expect(response.headers.get('content-disposition')).toBe(
      `attachment; filename="${ID}_v1.0.zip"`,
    )
    expect(response.headers.get('content-length')).toBe('4')
    expect(response.headers.get('cache-control')).toBe(
      'private, max-age=31536000, immutable',
    )
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
  })

  it('accepts a mouse transcript id', async () => {
    const response = await handlePreOptimizedZip(
      'ENSMUST00000108658',
      upstream(() => new Response('zip')),
    )
    expect(response.status).toBe(200)
  })

  it.each([
    ['an empty id', ''],
    ['a gene id', 'ENSG00000141510'],
    ['a short id', 'ENST0000026930'],
    ['a lowercase id', 'enst00000269305'],
    // The corpus keys transcripts unversioned, and so does the bucket.
    ['a versioned id', `${ID}.9`],
    ['another species', 'ENSDART00000000001'],
    ['a path', '../../secret'],
    ['an id with a path after it', `${ID}/../x`],
    ['an encoded traversal', `${ID}%2F..`],
    ['a query', `${ID}?x=1`],
  ])('refuses %s without fetching anything', async (_case, id) => {
    const fetchUpstream = upstream(() => new Response('zip'))

    const response = await handlePreOptimizedZip(id, fetchUpstream)

    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(fetchUpstream).not.toHaveBeenCalled()
  })

  it('answers 404 when the bucket has no package', async () => {
    const response = await handlePreOptimizedZip(
      ID,
      upstream(() => new Response('<Error>NoSuchKey</Error>', { status: 404 })),
    )

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).not.toBe('application/zip')
    expect(response.headers.get('cache-control')).toBe('no-store')
    // The bucket's XML never reaches the page.
    expect(await response.text()).not.toContain('NoSuchKey')
  })

  it.each([500, 403, 503])(
    'answers 502 when the bucket answers %i',
    async (status) => {
      const response = await handlePreOptimizedZip(
        ID,
        upstream(() => new Response('<Error/>', { status })),
      )

      expect(response.status).toBe(502)
      expect(response.headers.get('cache-control')).toBe('no-store')
    },
  )

  it('answers 502 when the bucket cannot be reached', async () => {
    const response = await handlePreOptimizedZip(
      ID,
      upstream(() => Promise.reject(new TypeError('network down'))),
    )

    expect(response.status).toBe(502)
  })
})
