'use client'

import { create } from 'zustand'

// Sidebar state lives in Zustand rather than React context so consumers can
// subscribe to specific slices without re-rendering on unrelated changes
// (e.g. width-drag updates don't re-render every menu item).
//
// Persistence uses localStorage directly (not zustand/persist) so the preload
// script in src/app/layout.tsx can read the same keys pre-hydration — we keep
// the existing two-key format so the flash-of-default-sidebar stays fixed.
const SIDEBAR_STORAGE_STATE = 'rej-sidebar-state'
const SIDEBAR_STORAGE_WIDTH = 'rej-sidebar-width'

export const SIDEBAR_WIDTH_DEFAULT = 256
export const SIDEBAR_WIDTH_MIN = 200
export const SIDEBAR_WIDTH_MAX = 480

type SidebarStore = {
  open: boolean
  openMobile: boolean
  width: number
  setOpen: (open: boolean) => void
  setOpenMobile: (open: boolean) => void
  /** In-memory width update — used during pointer drag. Doesn't persist. */
  setWidth: (width: number) => void
  /** Writes current width to localStorage. Call on pointer-up / double-click. */
  commitWidth: () => void
  /** Toggles sidebar open state. Branches on isMobile at call time. */
  toggle: (isMobile: boolean) => void
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // localStorage may be unavailable (private mode, quota) — preference
    // just doesn't persist across reloads, which is acceptable.
  }
}

function clampWidth(w: number) {
  return Math.round(Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, w)))
}

// Read preload attributes synchronously at module load so the store's initial
// state already matches the user's persisted preference on the very first
// client render — no flash-of-default-sidebar. The preload script in
// src/app/layout.tsx sets these on <html> before React hydrates.
//
// The SSR render uses the fallback values below (document is undefined there),
// so the client's first render can diverge from the server HTML for users
// with a non-default preference. Callers that depend on this data (the
// sidebar wrapper's CSS var, the Sidebar's data-state attr) must opt into
// suppressHydrationWarning on that element — same pattern as next-themes.
function readPreload(): { open: boolean; width: number } {
  if (typeof document === 'undefined') {
    return { open: true, width: SIDEBAR_WIDTH_DEFAULT }
  }
  const { sidebarPreloadOpen, sidebarPreloadWidth } =
    document.documentElement.dataset
  const widthNum = sidebarPreloadWidth ? Number(sidebarPreloadWidth) : NaN
  return {
    open: sidebarPreloadOpen === 'false' ? false : true,
    width: Number.isFinite(widthNum)
      ? clampWidth(widthNum)
      : SIDEBAR_WIDTH_DEFAULT,
  }
}

const preload = readPreload()

export const useSidebarStore = create<SidebarStore>((set, get) => ({
  open: preload.open,
  openMobile: false,
  width: preload.width,
  setOpen: (open) => {
    set({ open })
    writeStorage(SIDEBAR_STORAGE_STATE, String(open))
  },
  setOpenMobile: (openMobile) => set({ openMobile }),
  setWidth: (width) => set({ width: clampWidth(width) }),
  commitWidth: () => {
    writeStorage(SIDEBAR_STORAGE_WIDTH, String(get().width))
  },
  toggle: (isMobile) => {
    if (isMobile) {
      set((s) => ({ openMobile: !s.openMobile }))
    } else {
      const next = !get().open
      set({ open: next })
      writeStorage(SIDEBAR_STORAGE_STATE, String(next))
    }
  },
}))

export const selectSidebarState = (s: SidebarStore) =>
  s.open ? ('expanded' as const) : ('collapsed' as const)
