import { Outlet, createFileRoute } from '@tanstack/react-router'

/**
 * Layout for the gene pages (/genes and /genes/$symbol). Each page sets its
 * own error and not-found components, so those render inside this column
 * like the page would.
 */
export const Route = createFileRoute('/genes')({
  component: GenesLayout,
})

function GenesLayout() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12">
      <Outlet />
    </div>
  )
}
