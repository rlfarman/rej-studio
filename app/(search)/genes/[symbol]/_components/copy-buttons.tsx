'use client'
import { ClipboardIcon } from '@heroicons/react/20/solid'
import copy from 'copy-to-clipboard'
import { Tooltip } from 'react-tooltip'

interface CopyButtonProperties {
  children: string
}

function CopyButton({ children }: CopyButtonProperties) {
  function handleClick() {
    copy(children)
  }

  return (
    <div className="flex items-center">
      <button
        data-tooltip-id="my-tooltip"
        data-tooltip-content="Copied!"
        data-tooltip-place="right"
        type="button"
        className="group flex items-center rounded-lg text-center text-sm hover:underline"
        onClick={handleClick}
      >
        <span className="inline-block max-w-[12rem] select-all truncate font-medium">
          {children}
        </span>
        <ClipboardIcon className="-mr-1 ml-1 h-3.5 w-3.5 opacity-0 transition-opacity duration-100 group-hover:visible group-hover:opacity-100" />
      </button>
      <Tooltip
        noArrow
        id="my-tooltip"
        className="!rounded-lg !bg-transparent !px-2 !py-1 !font-normal !text-neutral-400 dark:!bg-neutral-800 dark:!text-white"
        openOnClick
        closeOnScroll
        closeOnEsc
      />
    </div>
  )
}

export default function CopyButtons({ isoform }: { isoform: Isoform }) {
  return (
    <div>
      <span className="text-sm text-neutral-500 dark:text-neutral-400">
        Coding sequence
      </span>
      {Boolean(isoform.codingSequence) && (
        <CopyButton>{`${isoform.codingSequence}`}</CopyButton>
      )}
      <span className="text-sm text-neutral-500 dark:text-neutral-400">
        Protein sequence
      </span>
      {Boolean(isoform.proteinSequence) && (
        <CopyButton>{`${isoform.proteinSequence}`}</CopyButton>
      )}
    </div>
  )
}
