'use client'
import { NameInput } from './name-input'
import { CodingSequenceInput } from './coding-sequence-input'
import { SpeciesOptions } from './species-options'

export function CustomizationOptions() {
  return (
    <div className="flex flex-col gap-4">
      <NameInput />
      <CodingSequenceInput />
      <SpeciesOptions />
    </div>
  )
}
