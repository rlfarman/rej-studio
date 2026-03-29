interface DesignToolLayoutProperties {
  children: React.ReactNode
}

function DesignToolLayout({ children }: DesignToolLayoutProperties) {
  return (
    <div>
      <div className="container mx-auto pb-6 sm:px-4">{children}</div>
    </div>
  )
}

export default DesignToolLayout
