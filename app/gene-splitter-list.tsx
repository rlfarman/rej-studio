'use client'
import { StateContext } from '@/context/context'
import cx from 'classnames'
import { Fragment, useContext } from 'react'
import { Transition } from '@headlessui/react'

interface TagProps {
  children: React.ReactNode
  bgColor?: string
}

function Tag({ children, bgColor }: TagProps) {
  return (
    <span
      className={cx(
        'inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2',
        bgColor
      )}
    >
      {children}
    </span>
  )
}

export default function GeneSplitterList() {
  const state = useContext(StateContext)
  console.log(state)
  return (
    <div className="flex flex-col gap-4">
      {state.selected.map((gene) => (
        <Transition
          key={gene.id}
          as={Fragment}
          appear
          show
          enter="transition-opacity duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="w-full max-w-md rounded-lg overflow-hidden border-2 border-emerald-300 bg-white">
            <div className="px-6 py-4">
              <div className="text-sm text-gray-500 mb-2">{gene.symbol}</div>
              <div className="text-gray-900 font-bold text-xl">{gene.name}</div>
              <div className="text-gray-900">Length: {gene.length}</div>
            </div>
            <div className="px-6 pt-4 pb-2">
              <Tag
                bgColor={
                  gene.species === 'Human' ? 'bg-blue-200' : 'bg-green-200'
                }
              >
                {gene.species}
              </Tag>
              {gene.isDiseaseAssociated && (
                <Tag bgColor="bg-red-200">Disease associated</Tag>
              )}
              {gene.isOversized && <Tag>Oversized</Tag>}
            </div>
          </div>
        </Transition>
      ))}
    </div>
  )
}
