'use client'

import { useCallback, useRef, useSyncExternalStore } from 'react'

function getServerSnapshot<T>(initialValue: T): () => T {
  return () => initialValue
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const cachedRaw = useRef<string | null>(null)
  const cachedValue = useRef<T>(initialValue)

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const handler = (e: StorageEvent) => {
        if (e.key === key) onStoreChange()
      }
      window.addEventListener('storage', handler)
      window.addEventListener(`local-storage:${key}`, onStoreChange)
      return () => {
        window.removeEventListener('storage', handler)
        window.removeEventListener(`local-storage:${key}`, onStoreChange)
      }
    },
    [key],
  )

  const getSnapshot = useCallback(() => {
    const raw = localStorage.getItem(key)
    if (raw !== cachedRaw.current) {
      cachedRaw.current = raw
      if (raw === null) {
        cachedValue.current = initialValue
      } else {
        try {
          cachedValue.current = JSON.parse(raw) as T
        } catch {
          cachedValue.current = initialValue
        }
      }
    }
    return cachedValue.current
  }, [key, initialValue])

  const value = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot(initialValue),
  )

  const setValue = useCallback(
    (updater: T | ((prev: T) => T)) => {
      const current = getSnapshot()
      const next = updater instanceof Function ? updater(current) : updater
      localStorage.setItem(key, JSON.stringify(next))
      window.dispatchEvent(new Event(`local-storage:${key}`))
    },
    [key, getSnapshot],
  )

  return [value, setValue] as const
}
