'use client'
import { Fragment, useState } from 'react'
import { Combobox, Transition } from '@headlessui/react'
import { ChevronUpDownIcon } from '@heroicons/react/20/solid'
import genes from '@/public/data/genes.json'
import { useRouter } from 'next/navigation'

const getMatch = (gene: Gene, query: string) => {
  return [
    gene.symbol,
    gene.name,
    ...gene.isoforms.map((isoform) => isoform.ENST),
  ].some((s) =>
    s
      .toLowerCase()
      .replace(/\s+/g, '')
      .includes(query.toLowerCase().replace(/\s+/g, ''))
  )
}

interface GeneSearchProperties {
  defaultGene?: Gene
}

export default function GeneSearch({ defaultGene }: GeneSearchProperties) {
  const [selected, setSelected] = useState<Gene | ''>(defaultGene ?? '')
  const [query, setQuery] = useState('')
  const router = useRouter()

  const handleChange = (gene: Gene) => {
    setSelected(gene)
    setQuery(gene.symbol)
    router.push(`/genes/${gene.symbol}`)
  }

  const filteredGenes =
    query === ''
      ? (genes as Gene[])
      : (genes as Gene[]).filter((gene) => getMatch(gene, query))

  return (
    <Combobox value={selected} onChange={handleChange}>
      {({ open }) => (
        <div className="relative">
          <div className="relative mt-2 inline-block cursor-default overflow-hidden">
            <Combobox.Input
              className="block w-full rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white dark:placeholder-neutral-400"
              displayValue={(gene: Gene) =>
                query !== '' ? query : gene.symbol
              }
              onChange={(event) => setQuery(event.target.value)}
              // Hack to make the combobox open when clicking on the input
              onClick={(event: any) => {
                if (
                  event.relatedTarget?.id?.includes(
                    'headlessui-combobox-button'
                  )
                ) {
                  return
                }
                if (!open) {
                  event.target.nextSibling.click()
                }
              }}
            />
            <Combobox.Button className="absolute inset-y-0 right-0 top-0 flex items-center pr-2">
              <ChevronUpDownIcon
                className="dark: h-4 w-4 text-neutral-500 dark:text-neutral-400"
                aria-hidden="true"
              />
            </Combobox.Button>
          </div>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Combobox.Options className="absolute z-10 mt-1 max-h-96 w-full max-w-sm divide-y divide-neutral-100 overflow-auto rounded-lg bg-white py-2 shadow dark:bg-neutral-700">
              {filteredGenes.length === 0 && query !== '' ? (
                <div className="relative cursor-default select-none px-4 py-2 text-neutral-700">
                  Nothing found.
                </div>
              ) : (
                <>
                  {filteredGenes.slice(0, 100).map((gene) => (
                    <Combobox.Option
                      key={gene.symbol}
                      className={({ active }) =>
                        `relative w-full select-none px-4 py-2 text-sm ${
                          active && 'bg-sky-50 dark:bg-sky-800'
                        }`
                      }
                      value={gene}
                    >
                      {({ selected }) => (
                        <>
                          <span
                            className={`block truncate ${
                              selected ? 'font-bold' : 'font-normal'
                            }`}
                          >
                            {gene.symbol}
                          </span>
                          <span
                            className={`block truncate text-sm text-neutral-500 dark:text-neutral-300 ${
                              selected ? 'font-bold' : 'font-normal'
                            }`}
                          >
                            {gene.name}
                          </span>
                        </>
                      )}
                    </Combobox.Option>
                  ))}
                  {filteredGenes.length > 100 && (
                    <div className="relative cursor-default select-none bg-neutral-50 px-4 py-2 text-neutral-700 dark:bg-neutral-700 dark:text-white">
                      Refine your search to show more results
                    </div>
                  )}
                </>
              )}
            </Combobox.Options>
          </Transition>
        </div>
      )}
    </Combobox>
  )
}
