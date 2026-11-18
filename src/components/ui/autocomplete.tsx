import * as React from 'react'
import { Autocomplete as AutocompletePrimitive } from '@base-ui/react/autocomplete'
import { cn } from 'cn'
import { SearchIcon } from 'lucide-react'

import { InputGroup, InputGroupAddon } from '@/components/ui/input-group'

/*
 * Base UI's Autocomplete styled for base-rhea, for lists that run an action
 * (Enter or click) rather than store a selection. shadcn's registry has a
 * Combobox (selection, popup) but no Autocomplete, so these parts follow its
 * classes. Only the inline parts are here: render the root with `inline open`
 * and put it in a page or a Dialog, as in Base UI's command palette example
 * (https://base-ui.com/react/components/autocomplete#command-palette).
 */

const Autocomplete = AutocompletePrimitive.Root

function AutocompleteInput({
  className,
  endAddon,
  ...props
}: AutocompletePrimitive.Input.Props & {
  /** Rendered at the input's trailing edge, e.g. a shortcut hint. */
  endAddon?: React.ReactNode
}) {
  return (
    <div data-slot="autocomplete-input-wrapper" className="p-1 pb-0">
      <InputGroup className="h-8! bg-input/50">
        <AutocompletePrimitive.Input
          data-slot="autocomplete-input"
          className={cn(
            'w-full text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          {...props}
        />
        <InputGroupAddon>
          <SearchIcon className="size-4 shrink-0 opacity-50" />
        </InputGroupAddon>
        {endAddon ? (
          <InputGroupAddon align="inline-end">{endAddon}</InputGroupAddon>
        ) : null}
      </InputGroup>
    </div>
  )
}

function AutocompleteList({
  className,
  ...props
}: AutocompletePrimitive.List.Props) {
  return (
    <AutocompletePrimitive.List
      data-slot="autocomplete-list"
      className={cn(
        // The scrollbar stays visible: it is the only sign that a clipped
        // list has more rows below the one cut off at the bottom edge.
        'max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto overscroll-contain outline-none',
        className,
      )}
      {...props}
    />
  )
}

function AutocompleteGroup({
  className,
  ...props
}: AutocompletePrimitive.Group.Props) {
  return (
    <AutocompletePrimitive.Group
      data-slot="autocomplete-group"
      // A hairline between consecutive groups, drawn by the later group so
      // the listbox holds only groups and options.
      className={cn(
        'overflow-hidden p-1 text-foreground not-first:border-t not-first:border-border/50',
        className,
      )}
      {...props}
    />
  )
}

function AutocompleteGroupLabel({
  className,
  ...props
}: AutocompletePrimitive.GroupLabel.Props) {
  return (
    <AutocompletePrimitive.GroupLabel
      data-slot="autocomplete-group-label"
      className={cn(
        'px-2 py-1.5 text-xs font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

const AutocompleteCollection = AutocompletePrimitive.Collection

function AutocompleteItem({
  className,
  ...props
}: AutocompletePrimitive.Item.Props) {
  return (
    <AutocompletePrimitive.Item
      data-slot="autocomplete-item"
      className={cn(
        "relative flex min-h-7 cursor-default items-center gap-2 rounded-xl px-2 py-1.5 text-sm outline-hidden select-none in-data-[slot=dialog-content]:rounded-2xl data-highlighted:bg-muted data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-highlighted:*:[svg]:text-foreground",
        className,
      )}
      {...props}
    />
  )
}

export {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
}
