import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from 'storybook/test'
import { RadioGroup, RadioGroupItem } from './radio-group'
import { Label } from './label'

const meta = {
  title: 'UI/RadioGroup',
  component: RadioGroup,
} satisfies Meta<typeof RadioGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="dna">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="dna" id="dna" />
        <Label htmlFor="dna">DNA</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="protein" id="protein" />
        <Label htmlFor="protein">Protein</Label>
      </div>
    </RadioGroup>
  ),
}

export const WithThreeOptions: Story = {
  render: () => (
    <RadioGroup defaultValue="human">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="human" id="r-human" />
        <Label htmlFor="r-human">Human</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="mouse" id="r-mouse" />
        <Label htmlFor="r-mouse">Mouse</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="both" id="r-both" />
        <Label htmlFor="r-both">Both</Label>
      </div>
    </RadioGroup>
  ),
}

export const SelectOption: Story = {
  render: () => (
    <RadioGroup>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="a" id="opt-a" />
        <Label htmlFor="opt-a">Option A</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="b" id="opt-b" />
        <Label htmlFor="opt-b">Option B</Label>
      </div>
    </RadioGroup>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const optionB = canvas.getByLabelText('Option B')
    await userEvent.click(optionB)
    await expect(optionB).toBeChecked()
  },
}
