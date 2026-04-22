import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from 'storybook/test'
import { SpeciesSelect } from './species-select'
import { useSpeciesStore } from '@/stores/species-store'
import { useEffect } from 'react'

function WithSpecies({
  initial,
  children,
}: {
  initial: 'human' | 'mouse' | 'both'
  children: React.ReactNode
}) {
  const setSpecies = useSpeciesStore((s) => s.setSpecies)
  useEffect(() => setSpecies(initial), [initial, setSpecies])
  return <>{children}</>
}

const meta = {
  title: 'Bio/SpeciesSelect',
  component: SpeciesSelect,
  decorators: [
    (Story) => (
      <WithSpecies initial="both">
        <Story />
      </WithSpecies>
    ),
  ],
} satisfies Meta<typeof SpeciesSelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithLabel: Story = {
  args: { alwaysShowLabel: true },
}

export const HumanSelected: Story = {
  decorators: [
    (Story) => (
      <WithSpecies initial="human">
        <Story />
      </WithSpecies>
    ),
  ],
}

export const MouseSelected: Story = {
  decorators: [
    (Story) => (
      <WithSpecies initial="mouse">
        <Story />
      </WithSpecies>
    ),
  ],
}

export const SelectSpecies: Story = {
  args: { alwaysShowLabel: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('combobox')
    await userEvent.click(trigger)
    const option = await within(document.body).findByText('Mice')
    await userEvent.click(option)
    await expect(trigger).toHaveTextContent('Mice')
  },
}
