export default async function GeneSearchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="container mx-auto overflow-hidden px-4 pb-6">
      {children}
    </div>
  )
}
