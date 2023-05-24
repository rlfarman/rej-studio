'use client'

import { Fragment, useState } from 'react'
import { Combobox as HeadlessCombobox, Transition } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid'
import genes from '../public/genes.json'
import { VariableSizeList as List, ListChildComponentProps } from 'react-window'

type Gene = (typeof genes)[number]

function Option({ data, index, style }: ListChildComponentProps) {
  const gene = data[index]
  return (
    <HeadlessCombobox.Option
      key={gene['Search Name']}
      className={({ active }) =>
        `relative cursor-default select-none py-2 pl-10 pr-4 ${
          active ? 'bg-emerald-600 text-white' : 'text-gray-900'
        }`
      }
      value={gene}
      style={style}
    >
      {({ selected, active }) => (
        <>
          <span
            className={`block truncate ${
              selected ? 'font-bold' : 'font-normal'
            }`}
          >
            {gene['Search Name']}
          </span>
          {selected ? (
            <span
              className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                active ? 'text-white' : 'text-emerald-600'
              }`}
            >
              <CheckIcon className="h-5 w-5" aria-hidden="true" />
            </span>
          ) : null}
        </>
      )}
    </HeadlessCombobox.Option>
  )
}

export default function Combobox({
  onSelect,
}: {
  onSelect: (value: Gene) => void
}) {
  const [selected, setSelected] = useState<Gene | null>(null)
  const [query, setQuery] = useState('')
  const filteredGenes =
    query === ''
      ? genes
      : genes.filter((gene) =>
          gene['Search Name']
            .toLowerCase()
            .replace(/\s+/g, '')
            .includes(query.toLowerCase().replace(/\s+/g, ''))
        )

  function handleSelected(value: Gene) {
    setSelected(value)
    onSelect(value)
  }

  return (
    <HeadlessCombobox value={selected} onChange={handleSelected}>
      <div className="relative mt-1 w-64 md:w-96">
        <div className="relative w-full cursor-default overflow-hidden rounded-lg bg-white text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-300 sm:text-sm">
          <HeadlessCombobox.Input
            className="w-full border-none py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 focus:ring-0"
            displayValue={(gene: Gene) => gene?.['Search Name']}
            onChange={(event) => setQuery(event.target.value)}
          />
          <HeadlessCombobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronUpDownIcon
              className="h-5 w-5 text-gray-400"
              aria-hidden="true"
            />
          </HeadlessCombobox.Button>
        </div>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          afterLeave={() => setQuery('')}
        >
          <HeadlessCombobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
            {filteredGenes.length === 0 && query !== '' ? (
              <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
                Nothing found.
              </div>
            ) : (
              <List
                itemData={filteredGenes}
                height={200}
                itemCount={filteredGenes.length}
                itemSize={() => 40}
                width="100%"
              >
                {Option}
              </List>
            )}
          </HeadlessCombobox.Options>
        </Transition>
      </div>
    </HeadlessCombobox>
  )
}
