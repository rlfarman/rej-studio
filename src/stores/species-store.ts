import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { SpeciesFilter } from '@/lib/bio/species'

/**
 * The species filter the user picked for search (the command palette's
 * All / Human / Mouse toggle), remembered across visits.
 *
 * Only an explicit choice writes it. Pages with their own species, such as a
 * gene page or /genes?species=, keep it in their URL instead: visiting a
 * mouse gene must not quietly narrow the next search to mouse.
 */
interface SpeciesState {
  species: SpeciesFilter
  handleSpeciesChange: (value: SpeciesFilter) => void
}

export const useSpeciesStore = create<SpeciesState>()(
  persist(
    (set) => ({
      species: 'both',
      handleSpeciesChange: (value) => set({ species: value }),
    }),
    {
      name: 'species',
      // v0 also saved the species of every gene page visited, so a stored
      // value may not be a choice the user made. Start everyone at 'both'.
      version: 1,
      migrate: () => ({ species: 'both' }),
      // window.localStorage, not the bare global: Node 26 defines its own
      // localStorage and warns when it's touched during SSR. On the server
      // `window` is undefined, createJSONStorage catches that, and the store
      // simply doesn't persist there.
      storage: createJSONStorage(() => window.localStorage),
    },
  ),
)

// Back-compat hook name for existing consumers.
export function useSpeciesContext() {
  const species = useSpeciesStore((s) => s.species)
  const handleSpeciesChange = useSpeciesStore((s) => s.handleSpeciesChange)
  return { species, handleSpeciesChange }
}
