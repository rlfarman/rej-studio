'use client'
import { NameInput } from './name-input'
import { CodingSequenceInput } from './coding-sequence-input'
import { SpeciesOptions } from './species-options'

export function CustomizationOptions() {
  return (
    <div>
      <div className="grid grid-rows-2 gap-4">
        <NameInput />
        <CodingSequenceInput />
        <SpeciesOptions />
      </div>
    </div>
  )
}
