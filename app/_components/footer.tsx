export default function Footer() {
  return (
    <div className="flex flex-col pt-4">
      <span className="text-gray-400 dark:text-gray-500">
        Created by{' '}
        <a
          href="https://www.linkedin.com/in/ryan-hsu-18647295/"
          className="text-gray-500 hover:underline dark:text-gray-400"
        >
          Ryan Hsu
        </a>{' '}
        and{' '}
        <a
          href="https://www.linkedin.com/in/rlfarman/"
          className="text-gray-500 hover:underline dark:text-gray-400"
        >
          Richie Farman
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
