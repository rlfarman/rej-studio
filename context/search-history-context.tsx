'use client'

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  ReactNode,
} from 'react'
import { useLocalStorage } from '@/lib/use-local-storage'

interface SearchHistoryContextValue {
  searchHistory: string[]
  addSearchQuery: (query: string) => void
  clearSearchHistory: () => void
}

const SearchHistoryContext = createContext<
  SearchHistoryContextValue | undefined
>(undefined)

const EMPTY: string[] = []

export function SearchHistoryProvider({ children }: { children: ReactNode }) {
  const [searchHistory, setSearchHistory] = useLocalStorage<string[]>(
    'searchHistory',
    EMPTY,
  )

  const addSearchQuery = useCallback(
    (query: string) => {
      const trimmed = query.trim()
      if (!trimmed) return
      setSearchHistory((prev) =>
        [trimmed, ...prev.filter((q) => q.toLowerCase() !== trimmed.toLowerCase())].slice(0, 10),
      )
    },
    [setSearchHistory],
  )

  const clearSearchHistory = useCallback(() => {
    setSearchHistory([])
  }, [setSearchHistory])

  const value = useMemo(
    () => ({ searchHistory, addSearchQuery, clearSearchHistory }),
    [searchHistory, addSearchQuery, clearSearchHistory],
  )

  return (
    <SearchHistoryContext.Provider value={value}>
      {children}
    </SearchHistoryContext.Provider>
  )
}

export function useSearchHistory() {
  const context = useContext(SearchHistoryContext)
  if (!context) {
    throw new Error(
      'useSearchHistory must be used within a SearchHistoryProvider',
    )
  }
  return context
}
