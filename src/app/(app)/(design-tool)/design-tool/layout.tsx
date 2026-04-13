import { DesignToolTour } from '@/features/onboarding/components/design-tool-tour'

interface DesignToolLayoutProperties {
  children: React.ReactNode
}

function DesignToolLayout({ children }: DesignToolLayoutProperties) {
  return (
    <div className="container mx-auto pb-6 sm:px-4">
      {children}
      <DesignToolTour />
    </div>
  )
}

export default DesignToolLayout
