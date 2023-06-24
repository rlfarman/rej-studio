export default function Footer() {
  return (
    <div className="flex flex-col pt-4">
      <span className="text-gray-400 dark:text-gray-500">
        Created by{' '}
        <a
          href="https://github.com/ryanusahk"
          className="text-gray-500 hover:underline dark:text-gray-400"
        >
          ryanusahk
        </a>{' '}
        and{' '}
        <a
          href="https://github.com/rlfarman"
          className="text-gray-500 hover:underline dark:text-gray-400"
        >
          rlfarman
        </a>
      </span>
      <span className="text-sm text-gray-400 hover:underline dark:text-gray-500">
        <a href="https://www.salk.edu/">
          PFAFF Lab at the Salk Institute for Biological Studies
        </a>
      </span>
    </div>
  )
}
