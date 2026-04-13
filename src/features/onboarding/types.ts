export type TourPlacement = 'top' | 'bottom' | 'left' | 'right'

export interface TourStep {
  /** Unique step identifier */
  id: string
  /** CSS selector for the target element */
  target: string
  /** Step title */
  title: string
  /** Step description (supports line breaks) */
  description: string
  /** Preferred placement of the step card relative to the target */
  placement: TourPlacement
  /** Optional: override the default spotlight padding (px) */
  spotlightPadding?: number
}

export interface TourDefinition {
  /** Unique tour identifier */
  id: string
  /** Tour steps in order */
  steps: TourStep[]
}

export type TourId = 'home' | 'gene-detail' | 'design-tool'
