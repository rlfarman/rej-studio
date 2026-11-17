// Orchestrator for the "Seed data" demo action. Each feature owns its own
// seed module (favorites/recents in gene-search, jobs in design-tool); this
// file only composes them so the sidebar menu has a single entry point.
import {
  seedGeneSearchData,
  clearSeedGeneSearchData,
} from '@/features/gene-search/stores/seed'
import {
  seedDesignToolData,
  clearSeedDesignToolData,
} from '@/features/design-tool/hooks/seed'

export function seedUserData() {
  const { favorites, recents } = seedGeneSearchData()
  const { jobs } = seedDesignToolData()
  return { favorites, recents, jobs }
}

export function clearSeedUserData() {
  const { favorites, recents } = clearSeedGeneSearchData()
  const { jobs } = clearSeedDesignToolData()
  return { favorites, recents, jobs }
}
