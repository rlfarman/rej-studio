import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'

import { TooltipProvider } from '@/components/ui/tooltip'
import { appCopy } from '@/copy/app'
import { SAMPLE_GENE_COUNT } from '@/features/gene-search/corpus/gene-data-url'

import { SampleDataBadge } from './sample-data-badge'

const label = appCopy.sampleData.label(SAMPLE_GENE_COUNT)

function renderBadge() {
  render(
    <TooltipProvider>
      <SampleDataBadge />
    </TooltipProvider>,
  )
  return screen.getByLabelText(label)
}

describe('SampleDataBadge', () => {
  it('keeps its full name while the label is hidden on phones', () => {
    const badge = renderBadge()
    const text = badge.querySelector('span')
    // The label only appears from `sm` up; below it the chip is its icon
    // alone, so it cannot spill over the centred header search.
    expect(text?.className).toContain('hidden')
    expect(text?.className).toContain('sm:inline')
    expect(text?.textContent).toBe(label)
  })

  it('can shrink inside its header column rather than overflow it', () => {
    const badge = renderBadge()
    // The Badge primitive is shrink-0 w-fit; without these it stayed at its
    // full width in a 1fr grid column and drew over the search.
    expect(badge.className).toContain('shrink')
    expect(badge.className).not.toContain('shrink-0')
    expect(badge.className).toContain('min-w-0')
  })
})
