export default async function GeneSearchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="container mx-auto overflow-hidden pb-6 sm:px-4">
      {children}
    </div>
  )
}
