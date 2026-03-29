import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <h1 className="text-6xl font-bold text-neutral-300 dark:text-neutral-700">
        404
      </h1>
      <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
      <p className="mt-2 text-neutral-500 dark:text-neutral-400">
        The page you&apos;re looking for doesn&apos;t exist or may have been
        moved.
      </p>
      <Link
        href="/"
        className="mt-6 font-medium text-sky-600 hover:underline dark:text-sky-500"
      >
        Go back home
      </Link>
    </div>
  )
}
