import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from 'storybook/test'
import { Input } from './input'
import { Label } from './label'

const meta = {
  title: 'UI/Input',
  component: Input,
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'search', 'file'],
    },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { placeholder: 'Enter text...' },
}

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-64 gap-1.5">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" placeholder="you@example.com" />
    </div>
  ),
}

export const Password: Story = {
  args: { type: 'password', placeholder: 'Password' },
}

export const File: Story = {
  args: { type: 'file' },
}

export const Disabled: Story = {
  args: { disabled: true, placeholder: 'Disabled', value: 'Cannot edit' },
}

export const Invalid: Story = {
  args: { 'aria-invalid': true, defaultValue: 'bad@' },
}

export const Typing: Story = {
  args: { placeholder: 'Type here...' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByPlaceholderText('Type here...')
    await userEvent.click(input)
    await userEvent.type(input, 'ATGCATGC')
    await expect(input).toHaveValue('ATGCATGC')
  },
}
