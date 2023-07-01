interface GenePageLayoutProperties {
  children: React.ReactNode
}

export default function GenePageLayout({ children }: GenePageLayoutProperties) {
  return (
    <div>
      <hr className="my-8 h-px border-0 bg-gray-300 dark:bg-gray-700" />
      {children}
    </div>
  )
}
