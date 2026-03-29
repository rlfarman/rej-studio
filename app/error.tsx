'use client'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <h1 className="text-6xl font-bold text-neutral-300 dark:text-neutral-700">
        Error
      </h1>
      <h2 className="mt-4 text-xl font-semibold">Something went wrong</h2>
      <p className="mt-2 text-neutral-500 dark:text-neutral-400">
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="mt-6 font-medium text-sky-600 hover:underline dark:text-sky-500"
      >
        Try again
      </button>
    </div>
  )
}
