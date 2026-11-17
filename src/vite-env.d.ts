/// <reference types="vite-plus/client" />

interface ImportMetaEnv {
  /** Shows a dismissible banner across the app. Read at build time. */
  readonly VITE_MAINTENANCE_MESSAGE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
