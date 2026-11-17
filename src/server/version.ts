import { OPTIMIZER_WASM_DIGEST } from '@/features/design-tool/workers/optimizer-asset.generated'
import { geneDataUrl } from '@/features/gene-search/corpus/gene-data-url'

/**
 * What this build is, for `/api/version`: enough to tell which deploy is
 * answering without opening a dashboard.
 *
 * The commit, version and build time are fixed when the Worker is built
 * (`workerBuildInfo` in vite.config.ts defines them), because the Worker has
 * no git and no package.json at runtime.
 */
export interface VersionInfo {
  /** The app's package version. */
  version: string
  /** The commit built, from GIT_COMMIT_SHA; 'unknown' when unset or blank. */
  sha: string
  /** ISO 8601, when the Worker was built; 'unknown' outside a build. */
  buildTimestamp: string
  /** SHA-256 of the optimizer `.wasm` this build runs, in the tab and here. */
  optimizerSha256: string
  /** The gene corpus this build points at. */
  corpus: {
    url: string
    /**
     * The version directory the URL names (`…/v3` → `v3`), which is how
     * corpus versions are published; 'sample' for the committed sample.
     */
    version: string
  }
}

/** Blank counts as unset: `GIT_COMMIT_SHA= pnpm build` must not report ''. */
function orUnknown(value: string | undefined): string {
  return value?.trim() || 'unknown'
}

export function versionInfo(): VersionInfo {
  const url = geneDataUrl()
  return {
    version: orUnknown(import.meta.env.REJ_APP_VERSION),
    sha: orUnknown(import.meta.env.REJ_GIT_COMMIT_SHA),
    buildTimestamp: orUnknown(import.meta.env.REJ_BUILD_TIMESTAMP),
    optimizerSha256: OPTIMIZER_WASM_DIGEST,
    corpus: { url, version: url.split('/').filter(Boolean).at(-1) ?? url },
  }
}
