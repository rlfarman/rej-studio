import type { Meta, StoryObj } from '@storybook/react'
import { Slider } from './slider'

const meta = {
  title: 'UI/Slider',
  component: Slider,
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    min: { control: 'number' },
    max: { control: 'number' },
    step: { control: 'number' },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Slider>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { defaultValue: [50] },
}

export const Range: Story = {
  args: { defaultValue: [25, 75] },
}

export const WithStep: Story = {
  args: { defaultValue: [50], step: 10, min: 0, max: 100 },
}

export const Disabled: Story = {
  args: { defaultValue: [50], disabled: true },
}
