'use client'
import type { Gene } from '@/types/gene'
import { useEffect, useRef, useState } from 'react'
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Label,
} from '@headlessui/react'
import { ChevronUpDownIcon } from '@heroicons/react/20/solid'
import { useRouter } from 'next/navigation'

interface SearchResult {
  genes: Gene[]
  hasMore: boolean
}

interface GeneSearchProperties {
  defaultGene?: Gene
}

export default function GeneSearch({ defaultGene }: GeneSearchProperties) {
  const [selected, setSelected] = useState<Gene | null>(defaultGene ?? null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [results, setResults] = useState<SearchResult>({
    genes: [],
    hasMore: false,
  })
  const router = useRouter()
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    if (!active) return

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    const controller = new AbortController()
    setLoading(true)
    setError(false)

    debounceTimer.current = setTimeout(() => {
      const params = new URLSearchParams(query ? { q: query } : {})
      fetch(`/api/genes/search?${params}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data: SearchResult) => {
          setResults(data)
          setLoading(false)
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setLoading(false)
            setError(true)
          }
        })
    }, 250)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      controller.abort()
    }
  }, [query, active])

  const handleChange = (gene: Gene | null) => {
    if (!gene) return
    setSelected(gene)
    setQuery(gene.symbol)
    router.push(`/genes/${gene.symbol}`)
  }

  function handleFocus() {
    if (!active) setActive(true)
  }

  return (
    <Combobox
      value={selected}
      onChange={handleChange}
      onClose={() => {
        setQuery('')
        setSelected(defaultGene ?? null)
      }}
    >
      <div className="relative mt-2">
        <Label className="block text-sm">Search for a gene</Label>
        <div className="relative mt-1 inline-block cursor-default">
          <ComboboxInput
            className="block w-full rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-neutral-900 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white dark:placeholder-neutral-400"
            placeholder="Search by symbol, name, or ENST..."
            displayValue={(gene: Gene | null) =>
              query !== '' ? query : (gene?.symbol ?? '')
            }
            onChange={(event) => setQuery(event.target.value)}
            onFocus={handleFocus}
          />
          <ComboboxButton className="absolute inset-y-0 right-0 top-0 flex items-center pr-2">
            <ChevronUpDownIcon
              className="h-4 w-4 text-neutral-500 dark:text-neutral-400"
              aria-hidden="true"
            />
          </ComboboxButton>
        </div>
        <ComboboxOptions
          transition
          className="absolute z-10 mt-1 max-h-96 w-full max-w-sm divide-y divide-neutral-100 overflow-auto rounded-lg bg-white py-2 shadow transition duration-100 ease-in data-[leave]:opacity-0 dark:bg-neutral-700"
        >
          {error ? (
            <div className="px-4 py-2 text-sm text-red-600 dark:text-red-400">
              Search failed. Please try again.
            </div>
          ) : loading ? (
            <div className="px-4 py-2 text-sm text-neutral-500 dark:text-neutral-400">
              Searching...
            </div>
          ) : results.genes.length === 0 && query !== '' ? (
            <div className="relative cursor-default select-none px-4 py-2 text-neutral-700">
              Nothing found.
            </div>
          ) : (
            <>
              {results.genes.map((gene) => (
                <ComboboxOption
                  key={gene.symbol}
                  className="relative w-full select-none px-4 py-2 data-[focus]:bg-sky-50 data-[focus]:dark:bg-sky-800"
                  value={gene}
                >
                  <span className="block truncate font-medium">
                    {gene.symbol}
                  </span>
                  <span className="block truncate text-sm text-neutral-500 dark:text-neutral-300">
                    {gene.name}
                  </span>
                </ComboboxOption>
              ))}
              {results.hasMore && (
                <div className="relative cursor-default select-none bg-neutral-50 px-4 py-2 text-neutral-700 dark:bg-neutral-700 dark:text-white">
                  Refine your search to show more results
                </div>
              )}
            </>
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  )
}
