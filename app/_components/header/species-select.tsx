'use client'
import React, { useEffect, useState, createContext, useContext } from 'react'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
} from '@/components/ui/select'
import { SpeciesIcon } from '../species-icon'
import { useSpeciesContext } from '@/context/species-context'

export function SpeciesSelect() {
  const { species, handleSpeciesChange } = useSpeciesContext()

  return (
    <Select onValueChange={handleSpeciesChange} value={species}>
      <SelectTrigger className="hover:bg-accent lg:w-51 w-22 z-10 cursor-pointer border-none font-semibold shadow-none">
        <SelectValue>
          <div className="flex items-center">
            <SpeciesIcon species={species} />
            <span className="ml-3 hidden lg:block">
              {species === 'mouse'
                ? 'Mice'
                : species === 'human'
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
              <SpeciesIcon species="both" />
              <div className="ml-4">
                <span>Humans & Mice</span>
                <p className="text-muted-foreground">
                  Show all genes and isoforms
                </p>
              </div>
            </div>
          </SelectItem>
          <SelectItem value="human">
            <div className="flex items-center justify-between">
              <SpeciesIcon species="human" />
              <div className="ml-4">
                <span>Humans</span>
                <p className="text-muted-foreground">
                  Show only human genes and isoforms
                </p>
              </div>
            </div>
          </SelectItem>
          <SelectItem value="mouse">
            <div className="flex items-center justify-between">
              <SpeciesIcon species="mouse" />
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
