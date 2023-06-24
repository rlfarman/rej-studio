export default function Footer() {
  return (
    <div className="pt-4">
      <span className="block text-gray-400 dark:text-gray-600">
        Created by{' '}
        <a
          href="https://github.com/ryanusahk"
          className="text-gray-600 hover:underline dark:text-gray-400"
        >
          ryanusahk
        </a>{' '}
        and{' '}
        <a
          href="https://github.com/rlfarman"
          className="text-gray-600 hover:underline dark:text-gray-400"
        >
          rlfarman
        </a>
      </span>
      <span className="block text-xs text-gray-200 hover:underline dark:text-gray-800">
        <a href="https://www.salk.edu/">
          PFAFF Lab at the Salk Institute for Biological Studies
        </a>
      </span>
    </div>
  )
}
