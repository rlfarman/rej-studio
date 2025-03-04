'use client'
import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
} from '@/components/ui/select'

function SpeciesSelect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [defaultValue, setDefaultValue] = useState<string | undefined>(
    undefined
  )

  useEffect(() => {
    const species = searchParams.get('species')
    if (species) {
      setDefaultValue(species)
    }
  }, [searchParams])

  const handleSelectChange = (value: string) => {
    const url = new URL(window.location.href)
    if (value === 'both') {
      url.searchParams.delete('species')
      router.push(url.toString())
    } else {
      url.searchParams.set('species', value)
      router.push(url.toString())
    }
  }

  return (
    <Select onValueChange={handleSelectChange} value={defaultValue}>
      <SelectTrigger className="w-[180px] border-none shadow-none">
        <SelectValue placeholder="Choose species" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Species</SelectLabel>
          <SelectItem value="both">Humans & Mice</SelectItem>
          <SelectItem value="humans">Humans</SelectItem>
          <SelectItem value="mice">Mice</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export default SpeciesSelect
