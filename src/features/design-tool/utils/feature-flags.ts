// Client-readable feature flags for the design tool.
//
// These read `process.env.NEXT_PUBLIC_*` directly (rather than via the
// centralized `@/lib/env` module, which is server-only) so Next can
// statically inline the value into the client bundle at build time.
//
// Multi-split — two split points for triple-AAV cassettes — is hidden by
// default for the preview release. The data layer (form schema, optimizer)
// already supports up to two positions; this flag only gates the
// add/remove-splice UI. Set NEXT_PUBLIC_ENABLE_MULTI_SPLIT=true to restore
// it.
export const MULTI_SPLIT_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_MULTI_SPLIT === 'true'
