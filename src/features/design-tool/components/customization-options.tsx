'use client'
import { NameInput } from './name-input'
import { CodingSequenceInput } from './coding-sequence-input'

export function CustomizationOptions() {
  return (
    <div className="flex flex-col gap-6">
      <NameInput />
      <CodingSequenceInput />
    </div>
  )
}
