// Cookie names + width bounds shared between the client `SidebarProvider`
// and the server `(app)/layout` that reads cookies. Must NOT live in the
// 'use client' sidebar module — exporting plain strings from a client
// module turns them into opaque function references when imported into
// a server component, so cookieStore.get(...) silently returns undefined.
export const SIDEBAR_COOKIE_OPEN = 'sidebar_state'
export const SIDEBAR_COOKIE_WIDTH = 'sidebar_width'
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year
export const SIDEBAR_WIDTH_DEFAULT = 256
export const SIDEBAR_WIDTH_MIN = 200
export const SIDEBAR_WIDTH_MAX = 480
