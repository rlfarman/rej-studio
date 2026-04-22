import { DesignToolTour } from '@/features/onboarding/components/design-tool-tour'

interface DesignToolLayoutProperties {
  children: React.ReactNode
}

function DesignToolLayout({ children }: DesignToolLayoutProperties) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-8 pb-12 md:pt-12">
      {children}
      <DesignToolTour />
    </div>
  )
}

export default DesignToolLayout
