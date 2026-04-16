import type { Meta, StoryObj } from '@storybook/react'
import { SplitBar } from './split-bar'

const meta = {
  title: 'Bio/SplitBar',
  component: SplitBar,
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SplitBar>

export default meta
type Story = StoryObj<typeof meta>

export const Balanced: Story = {
  args: { fivePrimeLength: 2400, threePrimeLength: 2600 },
}

export const FiveHeavy: Story = {
  args: { fivePrimeLength: 4000, threePrimeLength: 1000 },
}

export const ThreeHeavy: Story = {
  args: { fivePrimeLength: 800, threePrimeLength: 4200 },
}

export const Short: Story = {
  args: { fivePrimeLength: 150, threePrimeLength: 150 },
}
