export default function Loading() {
  return (
    <div className="mt-4" role="status">
      <div className="animate-pulse">
        <div className="mt-4">
          <div className="mb-2 h-5 w-48 rounded-full bg-neutral-200 dark:bg-neutral-700" />
          <div className="mt-3 h-4 w-64 rounded-full bg-neutral-200 dark:bg-neutral-700" />
          <div className="mt-3 h-10 w-full max-w-xl rounded-lg bg-neutral-200 dark:bg-neutral-700" />
        </div>
        <div className="mt-6">
          <div className="mb-2 h-4 w-48 rounded-full bg-neutral-200 dark:bg-neutral-700" />
          <div className="mt-3 h-10 w-full max-w-xl rounded-lg bg-neutral-200 dark:bg-neutral-700" />
        </div>
        <div className="mt-8 h-[220px] w-full rounded-lg bg-neutral-200 dark:bg-neutral-700" />
        <div className="mt-6">
          <div className="mb-2 h-5 w-40 rounded-full bg-neutral-200 dark:bg-neutral-700" />
          <div className="mt-3 h-10 w-32 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
          <div className="mt-3 h-4 w-48 rounded-full bg-neutral-200 dark:bg-neutral-700" />
          <div className="mt-2 h-4 w-44 rounded-full bg-neutral-200 dark:bg-neutral-700" />
        </div>
        <div className="mt-8 h-10 w-56 rounded bg-neutral-200 dark:bg-neutral-700" />
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  )
}
