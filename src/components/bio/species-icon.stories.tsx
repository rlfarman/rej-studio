import type { Meta, StoryObj } from '@storybook/react'
import { SpeciesIcon } from './species-icon'

const meta = {
  title: 'Bio/SpeciesIcon',
  component: SpeciesIcon,
  argTypes: {
    species: {
      control: 'select',
      options: ['human', 'mouse', 'both', undefined],
    },
  },
} satisfies Meta<typeof SpeciesIcon>

export default meta
type Story = StoryObj<typeof meta>

export const Human: Story = {
  args: { species: 'human' },
}

export const Mouse: Story = {
  args: { species: 'mouse' },
}

export const Both: Story = {
  args: { species: 'both' },
}

export const Default: Story = {
  args: {},
}
