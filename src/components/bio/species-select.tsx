'use client'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
} from '@/components/ui/select'
import { SpeciesIcon } from './species-icon'
import { useSpeciesContext } from '@/stores/species-store'

interface SpeciesSelectProps {
  alwaysShowLabel?: boolean
  /**
   * Responsive visibility classes for the label. Consumers can override
   * the default (`hidden md:block`) to match surrounding layout —
   * e.g. `hidden sm:block` when there's more room on the row.
   */
  labelVisibilityClass?: string
}

export function SpeciesSelect({
  alwaysShowLabel = false,
  labelVisibilityClass = 'hidden md:block',
}: SpeciesSelectProps) {
  const { species, handleSpeciesChange } = useSpeciesContext()
  const speciesLabel =
    species === 'mouse'
      ? 'Mice'
      : species === 'human'
        ? 'Humans'
        : 'All Species'

  return (
    <Select onValueChange={handleSpeciesChange} value={species}>
      <SelectTrigger
        aria-label={`Species filter: ${speciesLabel}`}
        className="hover:bg-accent z-10 w-fit cursor-pointer gap-2 border-none font-semibold shadow-none"
      >
        <SelectValue>
          <div className="flex items-center">
            <SpeciesIcon species={species} />
            <span
              className={
                alwaysShowLabel ? 'ml-3' : `ml-3 ${labelVisibilityClass}`
              }
            >
              {speciesLabel}
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
                <span>All Species</span>
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
