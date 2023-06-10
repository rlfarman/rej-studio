import { ChangeEvent, Fragment, useContext } from 'react'
import { Combobox, Transition } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid'
import { DispatchContext, StateContext } from '@/context/context'

export default function GeneSplitterInput() {
  const dispatch = useContext(DispatchContext)
  const state = useContext(StateContext)

  const handleChangeQuery = (event: ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'query', payload: event?.target.value })
  }

  const handleChangeSelected = (selectedGenes: Gene[]) => {
    if (selectedGenes.length > 1) {
      const poppedGene = selectedGenes.pop()
      if (poppedGene !== undefined) {
        selectedGenes.unshift(poppedGene)
      }
    }
    dispatch({
      type: 'select',
      payload: selectedGenes,
    })
  }

  return (
    <Combobox value={state.selected} multiple onChange={handleChangeSelected}>
      {({ open }) => (
        <div className="relative w-64 lg:w-96">
          {/* <Combobox.Label>Choose genes for RNA end-joining:</Combobox.Label> */}
          <div className="relative w-full cursor-default overflow-hidden rounded-lg bg-white dark:bg-black text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white dark:focus-visible:ring-black focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-300 sm:text-sm">
            <Combobox.Input
              className="w-full border-none py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 focus:ring-0"
              displayValue={() => state.query}
              onChange={handleChangeQuery}
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
                className="h-5 w-5 text-gray-400"
                aria-hidden="true"
              />
            </Combobox.Button>
          </div>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            // afterLeave={() => setQuery('')}
          >
            <Combobox.Options className="z-10 absolute mt-1 max-h-96 w-full overflow-auto rounded-md bg-white dark:bg-black pt-1 text-base shadow-lg ring-1 ring-black dark:ring-white ring-opacity-5 focus:outline-none sm:text-sm">
              {state.genes.length === 0 && state.query !== '' ? (
                <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
                  Nothing found.
                </div>
              ) : (
                <>
                  {state.genes.slice(0, 100).map((gene) => (
                    <Combobox.Option
                      key={gene.id}
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
                            className={`block truncate dark:text-white opacity-75 ${
                              selected ? 'font-bold' : 'font-normal'
                            }`}
                          >
                            {gene.name}
                          </span>
                          <span
                            className={`block truncate dark:text-white opacity-75 ${
                              selected ? 'font-bold' : 'font-normal'
                            }`}
                          >
                            {gene.searchName}
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
                  {state.genes.length > 100 && (
                    <div className="relative cursor-default select-none bg-gray-50 text-gray-700 py-2 px-4">
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
