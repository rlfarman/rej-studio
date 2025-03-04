export default function Footer() {
  return (
    <div className="max-w-(--breakpoint-md) container mx-auto flex flex-col px-4 pb-4 pt-12">
      <h1 className="mt-2 text-neutral-400 dark:text-neutral-500">REJ</h1>
      <span className="mt-2 text-neutral-400 dark:text-neutral-500">
        Created by{' '}
        <a
          href="https://www.linkedin.com/in/ryan-hsu-18647295/"
          className="text-sky-600 hover:underline dark:text-sky-500"
        >
          Ryan Hsu
        </a>{' '}
        and{' '}
        <a
          href="https://www.linkedin.com/in/rlfarman/"
          className="text-sky-600 hover:underline dark:text-sky-500"
        >
          Richie Farman
        </a>
      </span>
      <span className="text-xs text-sky-600 hover:underline dark:text-sky-500">
        <a href="https://www.salk.edu/">
          PFAFF Lab at the Salk Institute for Biological Studies
        </a>
      </span>
    </div>
  )
}
