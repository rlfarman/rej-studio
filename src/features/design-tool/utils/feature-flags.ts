// Client-readable feature flags for the design tool, inlined by Vite at
// build time (see src/vite-env.d.ts).
//
// Multi-split — two split points for triple-AAV cassettes — is hidden by
// default for the preview release. The data layer (form schema, optimizer)
// already supports up to two positions; this flag only gates the
// add/remove-splice UI. Set VITE_ENABLE_MULTI_SPLIT=true to restore it.
export const MULTI_SPLIT_ENABLED =
  import.meta.env.VITE_ENABLE_MULTI_SPLIT === 'true'
