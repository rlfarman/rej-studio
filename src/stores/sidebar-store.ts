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

export const useSidebarStore = create<SidebarStore>((set, get) => ({
  open: true,
  openMobile: false,
  width: SIDEBAR_WIDTH_DEFAULT,
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

/**
 * Reads the preload data attributes set by the layout.tsx inline script and
 * syncs them into the store. Call once from SidebarProvider on mount — it
 * uses setState directly (not setOpen) so it doesn't round-trip back to
 * localStorage during hydration.
 */
export function hydrateSidebarFromDOM() {
  if (typeof document === 'undefined') return
  const dataset = document.documentElement.dataset
  const preloadOpen = dataset.sidebarPreloadOpen
  const preloadWidth = dataset.sidebarPreloadWidth
  const widthNum = preloadWidth ? Number(preloadWidth) : NaN

  const patch: Partial<SidebarStore> = {}
  if (preloadOpen === 'true') patch.open = true
  else if (preloadOpen === 'false') patch.open = false
  if (Number.isFinite(widthNum)) patch.width = clampWidth(widthNum)

  if (Object.keys(patch).length > 0) {
    useSidebarStore.setState(patch)
  }
}

export const selectSidebarState = (s: SidebarStore) =>
  s.open ? ('expanded' as const) : ('collapsed' as const)
