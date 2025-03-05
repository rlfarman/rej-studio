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
import { User, RatIcon } from 'lucide-react'

export function SpeciesSelect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState<string | undefined>(undefined)

  useEffect(() => {
    const species = searchParams.get('species')
    setValue(species ?? 'both')
  }, [searchParams])

  const handleSelectChange = (value: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('species', value)
    router.push(url.toString())
  }

  const renderIcon = (value: string | undefined) => {
    switch (value) {
      case 'humans':
        return <User className="size-5 mx-2.5" />
      case 'mice':
        return <RatIcon className="size-5 mx-2.5" />
      case 'both':
        return (
          <div className="flex">
            <User className="size-5" />
            <RatIcon className="size-5" />
          </div>
        )
      default:
        return (
          <div className="flex">
            <User className="size-5" />
            <RatIcon className="size-5" />
          </div>
        )
    }
  }

  return (
    <Select onValueChange={handleSelectChange} value={value}>
      <SelectTrigger className="hover:bg-accent lg:w-51 w-22 cursor-pointer border-none font-semibold shadow-none">
        <SelectValue>
          <div className="flex items-center">
            {renderIcon(value)}
            <span className="ml-3 hidden lg:block">
              {value === 'mice'
                ? 'Mice'
                : value === 'humans'
                ? 'Humans'
                : 'Humans & Mice'}
            </span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Choose a species</SelectLabel>
          <SelectItem value="both">
            <div className="flex items-center justify-between">
              {renderIcon('both')}
              <div className="ml-4">
                <span>Humans & Mice</span>
                <p className="text-muted-foreground">
                  Show all genes and isoforms
                </p>
              </div>
            </div>
          </SelectItem>
          <SelectItem value="humans">
            <div className="flex items-center justify-between">
              {renderIcon('humans')}
              <div className="ml-4">
                <span>Humans</span>
                <p className="text-muted-foreground">
                  Show only human genes and isoforms
                </p>
              </div>
            </div>
          </SelectItem>
          <SelectItem value="mice">
            <div className="flex items-center justify-between">
              {renderIcon('mice')}
              <div className="ml-4">
                <span>Mice</span>
                <p className="text-muted-foreground">
                  Show only mouse genes and isoforms
                </p>
              </div>
            </div>
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
