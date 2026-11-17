/// <reference types="vite-plus/client" />

// Public, build-time configuration: Vite inlines every VITE_ variable into
// the client bundle, so none of these may hold a secret. See .env.example.
interface ImportMetaEnv {
  /** Shows a dismissible banner across the app. */
  readonly VITE_MAINTENANCE_MESSAGE?: string
  /** Base URL of the static gene corpus; unset reads the committed sample. */
  readonly VITE_GENE_DATA_URL?: string
  /** "true" shows the design tool's second split point (triple-AAV). */
  readonly VITE_ENABLE_MULTI_SPLIT?: string

  // Defined for the Worker only, at build time (`workerBuildInfo` in
  // vite.config.ts), for /api/version. Undefined in the client bundle.
  /** GIT_COMMIT_SHA as given to the build; may be blank. */
  readonly REJ_GIT_COMMIT_SHA?: string
  /** package.json's version. */
  readonly REJ_APP_VERSION?: string
  /** When the build ran, ISO 8601. */
  readonly REJ_BUILD_TIMESTAMP?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
