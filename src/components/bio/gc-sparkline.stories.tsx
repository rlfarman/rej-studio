import type { Meta, StoryObj } from '@storybook/react'
import { GcSparkline } from './gc-sparkline'

const repeat = (s: string, n: number) => s.repeat(n)

const meta = {
  title: 'Bio/GcSparkline',
  component: GcSparkline,
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GcSparkline>

export default meta
type Story = StoryObj<typeof meta>

export const BalancedGC: Story = {
  args: {
    sequence: repeat('ATGCATGCATGCATGC', 50),
  },
}

export const HighGC: Story = {
  args: {
    sequence: repeat('GCGCGCGCGCGCGCGC', 50),
  },
}

export const LowGC: Story = {
  args: {
    sequence: repeat('ATATATATATATATATAT', 50),
  },
}

export const MixedRegions: Story = {
  args: {
    sequence:
      repeat('GCGCGCGCGCGCGCGC', 25) +
      repeat('ATATATATATATATATAT', 25) +
      repeat('ATGCATGCATGCATGC', 25),
  },
}

export const TooShort: Story = {
  name: 'Too Short (<60 bp, renders nothing)',
  args: { sequence: 'ATGCATGCATGCATGCATGCATGC' },
}
