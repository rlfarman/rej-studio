'use client'

import { useCallback, useSyncExternalStore } from 'react'

function getServerSnapshot<T>(initialValue: T): () => T {
  return () => initialValue
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const handler = (e: StorageEvent) => {
        if (e.key === key) onStoreChange()
      }
      // Listen for cross-tab changes
      window.addEventListener('storage', handler)
      // Custom event for same-tab changes
      window.addEventListener(`local-storage:${key}`, onStoreChange)
      return () => {
        window.removeEventListener('storage', handler)
        window.removeEventListener(`local-storage:${key}`, onStoreChange)
      }
    },
    [key],
  )

  const getSnapshot = useCallback(() => {
    const stored = localStorage.getItem(key)
    if (stored === null) return initialValue
    try {
      return JSON.parse(stored) as T
    } catch {
      return initialValue
    }
  }, [key, initialValue])

  const value = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot(initialValue),
  )

  const setValue = useCallback(
    (updater: T | ((prev: T) => T)) => {
      const current = (() => {
        const stored = localStorage.getItem(key)
        if (stored === null) return initialValue
        try {
          return JSON.parse(stored) as T
        } catch {
          return initialValue
        }
      })()
      const next = updater instanceof Function ? updater(current) : updater
      localStorage.setItem(key, JSON.stringify(next))
      window.dispatchEvent(new Event(`local-storage:${key}`))
    },
    [key, initialValue],
  )

  return [value, setValue] as const
}
