export default function Footer() {
  return (
    <div className="container mx-auto flex max-w-screen-md flex-col px-4 pt-12">
      <span className="mt-2 text-neutral-400 dark:text-neutral-500">
        Created by{' '}
        <a
          href="https://www.linkedin.com/in/ryan-hsu-18647295/"
          className="text-neutral-500 hover:underline dark:text-neutral-400"
        >
          Ryan Hsu
        </a>{' '}
        and{' '}
        <a
          href="https://www.linkedin.com/in/rlfarman/"
          className="text-neutral-500 hover:underline dark:text-neutral-400"
        >
          Richie Farman
        </a>
      </span>
      <span className="text-sm text-neutral-400 hover:underline dark:text-neutral-500">
        <a href="https://www.salk.edu/">
          PFAFF Lab at the Salk Institute for Biological Studies
        </a>
      </span>
    </div>
  )
}
