import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from 'storybook/test'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'
import { Button } from './button'

const meta = {
  title: 'UI/Tooltip',
  component: Tooltip,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Tooltip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline">Hover me</Button>
      </TooltipTrigger>
      <TooltipContent>This is a tooltip</TooltipContent>
    </Tooltip>
  ),
}

export const ShowOnHover: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="secondary">GC 48.2%</Button>
      </TooltipTrigger>
      <TooltipContent>
        GC content is in the optimal 35-60% range.
      </TooltipContent>
    </Tooltip>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByText('GC 48.2%')
    await userEvent.hover(trigger)
    const tooltip = await within(document.body).findByRole('tooltip')
    await expect(tooltip).toBeVisible()
  },
}
