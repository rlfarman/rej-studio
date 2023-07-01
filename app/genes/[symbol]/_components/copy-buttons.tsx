'use client'
import { ClipboardIcon } from '@heroicons/react/20/solid'
import copy from 'copy-to-clipboard'

export default function CopyButtons({ isoform }: { isoform: Isoform }) {
  return (
    <div>
      <button
        className="mt-1 flex items-center rounded-lg text-center text-sm font-medium hover:underline focus:outline-none focus:ring-4 focus:ring-sky-300 dark:focus:ring-sky-800"
        onClick={() => copy(isoform.codingSequence ?? '')}
      >
        <span className="hidden max-w-[12rem] truncate text-gray-400 dark:text-gray-600 sm:inline-block">
          {isoform.codingSequence}
        </span>
        <span className="inline-flex items-center text-gray-700 dark:text-gray-300">
          Copy coding sequence
          <ClipboardIcon className="-mr-1 ml-1 h-4 w-4" />
        </span>
      </button>
      <button
        className="mt-2 flex items-center rounded-lg text-center text-sm font-medium hover:underline focus:outline-none focus:ring-4 focus:ring-sky-300 dark:focus:ring-sky-800"
        onClick={() => copy(isoform.proteinSequence ?? '')}
      >
        <span className="hidden max-w-[12rem] truncate text-gray-400 dark:text-gray-600 sm:inline-block">
          {isoform.proteinSequence}
        </span>
        <span className="inline-flex items-center text-gray-700 dark:text-gray-300">
          Copy protein sequence
          <ClipboardIcon className="-mr-1 ml-1 h-4 w-4" />
        </span>
      </button>
    </div>
  )
}
