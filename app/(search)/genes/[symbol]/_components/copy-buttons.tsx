'use client'
import type { Isoform } from '@/types/isoform'
import { ClipboardIcon } from '@heroicons/react/20/solid'
import { useId, useState } from 'react'

function CopyButton({
  children,
  label,
}: {
  children: string
  label: string
}) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const id = useId()

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(children)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
    setTimeout(() => setStatus('idle'), 2000)
  }

  return (
    <div className="flex items-center">
      <button
        type="button"
        className="group flex items-center rounded-lg text-center hover:underline"
        onClick={handleClick}
        aria-label={`Copy ${label}`}
        aria-describedby={status !== 'idle' ? id : undefined}
      >
        <span className="inline-block max-w-[12rem] select-all truncate font-medium">
          {children}
        </span>
        <ClipboardIcon className="-mr-1 ml-1 h-3.5 w-3.5 opacity-0 transition-opacity duration-100 group-hover:visible group-hover:opacity-100" />
      </button>
      {status !== 'idle' && (
        <span
          id={id}
          role="status"
          className={`ml-2 text-sm font-normal ${status === 'failed' ? 'text-red-500' : 'text-neutral-400 dark:text-white'}`}
        >
          {status === 'copied' ? 'Copied!' : 'Failed to copy'}
        </span>
      )}
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
        <CopyButton label="coding sequence">{`${isoform.codingSequence}`}</CopyButton>
      )}
      <span className="text-sm text-neutral-500 dark:text-neutral-400">
        Protein sequence
      </span>
      {Boolean(isoform.proteinSequence) && (
        <CopyButton label="protein sequence">{`${isoform.proteinSequence}`}</CopyButton>
      )}
    </div>
  )
}
