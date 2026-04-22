import type { Meta, StoryObj } from '@storybook/react'
import { DiagBadge } from './diag-badge'
import { TooltipProvider } from '@/components/ui/tooltip'

const meta = {
  title: 'Bio/DiagBadge',
  component: DiagBadge,
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
} satisfies Meta<typeof DiagBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Good: Story = {
  args: {
    status: 'good',
    label: 'GC 48.2%',
    tooltip: 'GC content is in the optimal 35–60% range.',
  },
}

export const Warn: Story = {
  args: {
    status: 'warn',
    label: 'GC 28.1%',
    tooltip: 'GC content is outside the optimal 35–60% range.',
  },
}

export const Error: Story = {
  args: {
    status: 'error',
    label: 'No start codon',
    tooltip: 'Sequence does not begin with ATG.',
  },
}

export const Neutral: Story = {
  args: {
    status: 'neutral',
    label: '1,200 bp / 400 aa',
    tooltip: 'Sequence length in base pairs and amino acids',
  },
}

export const DiagStrip: Story = {
  name: 'Diagnostic Strip (multiple)',
  args: {
    status: 'neutral',
    label: '2,400 bp / 800 aa',
    tooltip: 'Sequence length',
  },
  render: () => (
    <div className="flex flex-wrap gap-1.5">
      <DiagBadge
        status="neutral"
        label="2,400 bp / 800 aa"
        tooltip="Sequence length"
      />
      <DiagBadge
        status="good"
        label="GC 48.2%"
        tooltip="GC content is in the optimal range."
      />
      <DiagBadge
        status="good"
        label="Start: ATG"
        tooltip="Sequence begins with ATG start codon"
      />
      <DiagBadge
        status="good"
        label="Stop: TAA"
        tooltip="Sequence ends with TAA stop codon"
      />
      <DiagBadge
        status="warn"
        label="Over single-AAV limit"
        tooltip="CDS exceeds the 4,000 bp single-AAV CDS limit — requires dual or triple AAV"
      />
    </div>
  ),
}
