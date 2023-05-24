'use client'
import { useState } from 'react'
import Combobox from './combobox'

export default function GeneSplitter() {
  const [selected, setSelected] = useState<any | null>(null)
  console.log(selected)
  return (
    <div className="pt-24 md:pt-36">
      <div className="relative flex place-items-center before:absolute before:h-[300px] before:w-[480px] before:-translate-x-1/2 before:rounded-full before:bg-gradient-radial before:from-white before:to-transparent before:blur-2xl before:content-[''] after:absolute after:-z-20 after:h-[180px] after:w-[240px] after:translate-x-1/3 after:bg-gradient-conic after:from-sky-200 after:via-emerald-200 after:blur-2xl after:content-[''] before:dark:bg-gradient-to-br before:dark:from-transparent before:dark:to-blue-700 before:dark:opacity-10 after:dark:from-sky-900 after:dark:via-[#0141ff] after:dark:opacity-40 before:lg:h-[360px]">
        <Combobox onSelect={setSelected} />
      </div>
      {selected && (
        <div className="flex place-items-center pt-32">
          <div className="w-64 md:w-96 rounded-lg overflow-hidden shadow-lg shadow-sky-100 border-2 border-emerald-300 bg-white">
            <div className="px-6 py-4">
              <div className="text-sm text-gray-500 mb-2">
                {selected.Symbol}
              </div>
              <div className="font-bold text-xl">{selected.Name}</div>
            </div>
            <div className="px-6 pt-4 pb-2">
              {selected['Disease Associated'] && (
                <span className="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2">
                  Disease associated
                </span>
              )}
              {selected.Oversized && (
                <span className="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2">
                  Oversized
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
