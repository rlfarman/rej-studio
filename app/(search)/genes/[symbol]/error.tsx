'use client'
import Link from 'next/link'

export default function GeneError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="py-12">
      <h2 className="text-xl font-semibold">Failed to load gene data</h2>
      <p className="mt-2 text-neutral-500 dark:text-neutral-400">
        There was a problem loading the sequence data for this gene. The data
        file may be missing or corrupted.
      </p>
      <div className="mt-6 flex gap-4">
        <button
          onClick={reset}
          className="font-medium text-sky-600 hover:underline dark:text-sky-500"
        >
          Try again
        </button>
        <Link
          href="/genes"
          className="font-medium text-sky-600 hover:underline dark:text-sky-500"
        >
          Back to search
        </Link>
      </div>
    </div>
  )
}
