import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ServerEnv } from './env'
import { handleHealth } from './health'

const TOKEN = 'h'.repeat(32)

const request = (authorization?: string) =>
  new Request('https://rej.example.com/api/health', {
    headers: authorization ? { authorization } : {},
  })

/**
 * A GENE_DATA binding whose `head` answers as told, with the spy beside it
 * (reading it off the binding is an unbound method).
 */
function bucket(answer: () => unknown) {
  const head = vi.fn(answer)
  const env: ServerEnv = {
    GENE_DATA: { head } as unknown as R2Bucket,
    HEALTH_AUTH_TOKEN: TOKEN,
  }
  return { env, head }
}

// A deep check reads the corpus out of R2, which only happens when the build
// points at an absolute corpus URL (a relative one is this build's own static
// assets, which the Worker serving them proves are there).
beforeEach(() => {
  vi.stubEnv('VITE_GENE_DATA_URL', 'https://genes.example.org/v1')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('an anonymous probe', () => {
  // Every ten minutes, from a monitor. It must cost the deployment nothing
  // and reveal nothing.
  it('gets liveness and nothing else', async () => {
    const response = await handleHealth(request(), {})

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('does not touch the corpus, even when it could', async () => {
    const { env, head } = bucket(() => ({}))
    await handleHealth(request(), env)

    expect(head).not.toHaveBeenCalled()
  })

  it.each([
    ['a wrong token', `Bearer ${'x'.repeat(32)}`],
    ['the token with no scheme', TOKEN],
  ])('stays shallow for %s', async (_case, header) => {
    const response = await handleHealth(request(header), bucket(() => ({})).env)

    expect(await response.json()).toEqual({ status: 'ok' })
  })
})

describe('an authorized probe', () => {
  it('checks the corpus and reports it healthy', async () => {
    const { env, head } = bucket(() => ({ size: 1 }))

    const response = await handleHealth(request(`Bearer ${TOKEN}`), env)
    const body = (await response.json()) as {
      status: string
      checks: { geneData: { status: string } }
      version: string
      timestamp: string
    }

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.checks.geneData.status).toBe('ok')
    expect(body.version).toBeTruthy()
    expect(Date.parse(body.timestamp)).not.toBeNaN()
    expect(head).toHaveBeenCalledOnce()
  })

  it('reports degraded, with a 503, when the corpus index is missing', async () => {
    const response = await handleHealth(
      request(`Bearer ${TOKEN}`),
      bucket(() => null).env,
    )
    const body = (await response.json()) as {
      status: string
      checks: { geneData: { status: string; error?: string } }
    }

    expect(response.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(body.checks.geneData).toMatchObject({ status: 'fail' })
  })

  it('reports a bucket that threw as a failed check, not a crash', async () => {
    const response = await handleHealth(
      request(`Bearer ${TOKEN}`),
      bucket(() => {
        throw new Error('R2 unreachable')
      }).env,
    )
    const body = (await response.json()) as {
      checks: { geneData: { status: string; error?: string } }
    }

    expect(response.status).toBe(503)
    expect(body.checks.geneData.error).toBe('R2 unreachable')
  })

  // Without a bucket there is nothing outside the Worker to check, so the
  // deep check would only ever say "skipped".
  it('stays shallow when no corpus is bound', async () => {
    const response = await handleHealth(request(`Bearer ${TOKEN}`), {
      HEALTH_AUTH_TOKEN: TOKEN,
    })

    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('stays shallow when no token is configured', async () => {
    const response = await handleHealth(request(`Bearer ${TOKEN}`), {
      GENE_DATA: { head: vi.fn() } as unknown as R2Bucket,
    })

    expect(await response.json()).toEqual({ status: 'ok' })
  })
})
