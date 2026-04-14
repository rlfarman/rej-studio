import { DesignToolTour } from '@/features/onboarding/components/design-tool-tour'

interface DesignToolLayoutProperties {
  children: React.ReactNode
}

function DesignToolLayout({ children }: DesignToolLayoutProperties) {
  return (
    <div className="container mx-auto px-4 pb-6">
      {children}
      <DesignToolTour />
    </div>
  )
}

export default DesignToolLayout
