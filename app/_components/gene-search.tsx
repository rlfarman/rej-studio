'use client'
import { Fragment, useState } from 'react'
import { Combobox, Transition } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid'
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
  const [selected, setSelected] = useState<Gene | undefined>(defaultGene)
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
          <Combobox.Label className="block">
            Search for a gene by name or symbol
          </Combobox.Label>
          <div className="relative inline-block cursor-default overflow-hidden">
            <Combobox.Input
              className="text-black"
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
            <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon
                className="h-4 w-4 text-black"
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
            <Combobox.Options className="absolute mt-1 max-h-96 overflow-auto bg-white text-black">
              {filteredGenes.length === 0 && query !== '' ? (
                <div className="relative cursor-default select-none px-4 py-2 text-gray-700">
                  Nothing found.
                </div>
              ) : (
                <>
                  {filteredGenes.slice(0, 100).map((gene) => (
                    <Combobox.Option
                      key={gene.symbol}
                      className={({ active }) =>
                        `relative cursor-default select-none py-2 pl-10 pr-4 ${
                          active ? 'bg-emerald-600 text-white' : 'text-gray-900'
                        }`
                      }
                      value={gene}
                    >
                      {({ selected, active }) => (
                        <>
                          <span
                            className={`block truncate ${
                              selected ? 'font-bold' : 'font-normal'
                            }`}
                          >
                            {gene.symbol}
                          </span>
                          <span
                            className={`block truncate text-sm ${
                              selected ? 'font-bold' : 'font-normal'
                            }`}
                          >
                            {gene.name}
                          </span>
                          {selected ? (
                            <span
                              className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                active ? 'text-white' : 'text-emerald-600'
                              }`}
                            >
                              <CheckIcon
                                className="h-5 w-5"
                                aria-hidden="true"
                              />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Combobox.Option>
                  ))}
                  {filteredGenes.length > 100 && (
                    <div className="relative cursor-default select-none bg-gray-50 px-4 py-2 text-gray-700">
                      Only showing the first 100 results.
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
