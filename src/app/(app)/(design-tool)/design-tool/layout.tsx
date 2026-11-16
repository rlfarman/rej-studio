interface DesignToolLayoutProperties {
  children: React.ReactNode
}

function DesignToolLayout({ children }: DesignToolLayoutProperties) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-8 pb-12 md:pt-12">
      {children}
    </div>
  )
}

export default DesignToolLayout
