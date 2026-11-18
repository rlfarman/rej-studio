import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from './autocomplete'

interface Group {
  label: string
  items: string[]
}

const GROUPS: Group[] = [
  { label: 'Genes', items: ['TP53', 'BRCA1', 'BRCA2'] },
  { label: 'Jobs', items: ['TP53 design'] },
]

function CommandList({ onRun }: { onRun: (item: string) => void }) {
  const [query, setQuery] = useState('')
  const q = query.toLowerCase()
  const groups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.toLowerCase().includes(q)),
  })).filter((group) => group.items.length > 0)

  return (
    <div className="w-80 rounded-3xl border bg-popover p-1">
      <Autocomplete
        inline
        open
        items={groups}
        filter={null}
        autoHighlight="always"
        value={query}
        onValueChange={(value, details) => {
          if (details.reason === 'input-change') setQuery(value)
        }}
      >
        <AutocompleteInput aria-label="Search" placeholder="Search…" />
        <AutocompleteList>
          {(group: Group) => (
            <AutocompleteGroup key={group.label} items={group.items}>
              <AutocompleteGroupLabel>{group.label}</AutocompleteGroupLabel>
              <AutocompleteCollection>
                {(item: string) => (
                  <AutocompleteItem
                    key={item}
                    value={item}
                    onClick={() => onRun(item)}
                  >
                    {item}
                  </AutocompleteItem>
                )}
              </AutocompleteCollection>
            </AutocompleteGroup>
          )}
        </AutocompleteList>
      </Autocomplete>
    </div>
  )
}

const meta = {
  title: 'UI/Autocomplete',
  component: CommandList,
  parameters: { layout: 'centered' },
  args: { onRun: fn() },
} satisfies Meta<typeof CommandList>

export default meta
type Story = StoryObj<typeof meta>

export const InlineCommandList: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('combobox', { name: 'Search' })
    await userEvent.type(input, 'brca')
    await expect(canvas.getAllByRole('option')).toHaveLength(2)
    // The first option starts highlighted; ArrowDown moves on, Enter runs it.
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await expect(args.onRun).toHaveBeenCalledWith('BRCA2')
    // Running an option leaves the typed query alone.
    await expect(input).toHaveValue('brca')
  },
}
