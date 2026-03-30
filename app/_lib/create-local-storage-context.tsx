'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface LocalStorageContextOptions<T> {
  key: string
  initialValue: T
  errorMessage: string
}

export function createLocalStorageContext<T>({
  key,
  initialValue,
  errorMessage,
}: LocalStorageContextOptions<T>) {
  const Context = createContext<
    { value: T; setValue: (value: T | ((prev: T) => T)) => void } | undefined
  >(undefined)

  function Provider({ children }: { children: ReactNode }) {
    const [value, setValueInternal] = useState<T>(() => {
      if (typeof window === 'undefined') return initialValue
      const stored = localStorage.getItem(key)
      if (stored) {
        try {
          return JSON.parse(stored)
        } catch (error) {
          console.error(`Failed to parse ${key} from localStorage:`, error)
        }
      }
      return initialValue
    })

    const setValue = (updater: T | ((prev: T) => T)) => {
      setValueInternal((prev) => {
        const next = updater instanceof Function ? updater(prev) : updater
        localStorage.setItem(key, JSON.stringify(next))
        return next
      })
    }

    return (
      <Context.Provider value={{ value, setValue }}>
        {children}
      </Context.Provider>
    )
  }

  function useValue() {
    const context = useContext(Context)
    if (!context) {
      throw new Error(errorMessage)
    }
    return context
  }

  return { Provider, useValue } as const
}
