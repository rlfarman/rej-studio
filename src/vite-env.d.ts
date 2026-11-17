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
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
