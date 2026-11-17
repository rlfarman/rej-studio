import { describe, expect, it, vi } from 'vite-plus/test'

import { OPTIMIZER_WASM_DIGEST } from '@/features/design-tool/workers/optimizer-asset.generated'

import { versionInfo } from './version'

describe('what the build reports about itself', () => {
  it('names the optimizer it runs and the corpus it points at', () => {
    const info = versionInfo()

    expect(info.optimizerSha256).toBe(OPTIMIZER_WASM_DIGEST)
    // Unset VITE_GENE_DATA_URL means the committed sample, in tests as in a
    // local build.
    expect(info.corpus.url).toBe('/gene-data/sample')
    expect(info.corpus.version).toBe('sample')
  })

  it('reads the corpus version out of a version directory', () => {
    vi.stubEnv('VITE_GENE_DATA_URL', 'https://genes.example.org/v3/')

    expect(versionInfo().corpus).toEqual({
      url: 'https://genes.example.org/v3',
      version: 'v3',
    })

    vi.unstubAllEnvs()
  })

  // The build inlines GIT_COMMIT_SHA, and a build run without one inlines an
  // empty string. Reporting '' as a commit is worse than saying unknown.
  it('says unknown rather than blank for a build with no commit', () => {
    const info = versionInfo()

    expect(info.sha).toBeTruthy()
    expect(info.version).toBeTruthy()
    expect(info.buildTimestamp).toBeTruthy()
  })
})
