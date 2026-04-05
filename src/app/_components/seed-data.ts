import { useFavoriteGenes } from '@/features/gene-search/stores/favorite-genes-store'
import { useRecentGenes } from '@/features/gene-search/stores/recent-genes-store'
import {
  useJobHistory,
  type JobHistoryEntry,
} from '@/features/design-tool/hooks/use-job-history'
import type { SavedGene } from '@/features/gene-search/types/domain-types'

const FAVORITE_SEED: SavedGene[] = [
  {
    id: 'ENSG00000141510',
    symbol: 'TP53',
    name: 'tumor protein p53',
    species: 'human',
  },
  {
    id: 'ENSG00000012048',
    symbol: 'BRCA1',
    name: 'BRCA1 DNA repair associated',
    species: 'human',
  },
  {
    id: 'ENSMUSG00000059552',
    symbol: 'Trp53',
    name: 'transformation related protein 53',
    species: 'mouse',
  },
]

const RECENT_SEED: SavedGene[] = [
  {
    id: 'ENSG00000146648',
    symbol: 'EGFR',
    name: 'epidermal growth factor receptor',
    species: 'human',
  },
  {
    id: 'ENSG00000136997',
    symbol: 'MYC',
    name: 'MYC proto-oncogene, bHLH transcription factor',
    species: 'human',
  },
  {
    id: 'ENSG00000075624',
    symbol: 'ACTB',
    name: 'actin beta',
    species: 'human',
  },
  {
    id: 'ENSMUSG00000029580',
    symbol: 'Actb',
    name: 'actin, beta',
    species: 'mouse',
  },
  {
    id: 'ENSMUSG00000022346',
    symbol: 'Myc',
    name: 'myelocytomatosis oncogene',
    species: 'mouse',
  },
]

// Minimal valid coding sequence: ATG + codons + stop, length divisible by 3.
const SAMPLE_CDS =
  'ATG' +
  'GCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCT' +
  'GCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCTGCT' +
  'TAA'

function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString()
}

// No 'running' seed: JobWatcher would immediately poll the backend,
// not find the job, and flip it to failed(not_found). Seeding running
// state honestly would require either a reserved id prefix the watcher
// skips, or a fake backend entry — neither worth the complexity.
const JOB_SEED: JobHistoryEntry[] = [
  {
    id: 'seed-job-completed-1',
    name: 'TP53 optimization',
    sequenceLength: SAMPLE_CDS.length,
    createdAt: minutesAgo(5),
    status: 'completed',
    result: {
      name: 'TP53 optimization',
      original_sequence: SAMPLE_CDS,
      optimized_sequence: SAMPLE_CDS,
      seq5: SAMPLE_CDS.slice(0, 60),
      seq3: SAMPLE_CDS.slice(60),
      split_point: 60,
      used_wggw_as_split: false,
      objectives_before: 'CAI: 0.72',
      objectives_after: 'CAI: 0.91',
      wggw_info: null,
      processing_time_seconds: 3.4,
    },
    error: null,
  },
  {
    id: 'seed-job-completed-2',
    name: 'BRCA1 exon 11',
    sequenceLength: SAMPLE_CDS.length,
    createdAt: minutesAgo(47),
    status: 'completed',
    result: {
      name: 'BRCA1 exon 11',
      original_sequence: SAMPLE_CDS,
      optimized_sequence: SAMPLE_CDS,
      seq5: SAMPLE_CDS.slice(0, 60),
      seq3: SAMPLE_CDS.slice(60),
      split_point: 60,
      used_wggw_as_split: true,
      objectives_before: 'CAI: 0.65',
      objectives_after: 'CAI: 0.88',
      wggw_info: null,
      processing_time_seconds: 5.1,
    },
    error: null,
  },
  {
    id: 'seed-job-failed-1',
    name: 'MYC transactivation',
    sequenceLength: SAMPLE_CDS.length,
    createdAt: minutesAgo(120),
    status: 'failed',
    result: null,
    error: {
      code: 'backend',
      message: 'Optimization failed: no feasible solution under constraints.',
      retriable: false,
    },
  },
  {
    id: 'seed-job-cancelled-1',
    name: 'ACTB control',
    sequenceLength: SAMPLE_CDS.length,
    createdAt: minutesAgo(240),
    status: 'cancelled',
    result: null,
    error: {
      code: 'cancelled',
      message: 'Cancelled',
      retriable: true,
    },
  },
]

export function seedUserData() {
  const favStore = useFavoriteGenes.getState()
  // Add in reverse so the first entry in FAVORITE_SEED ends up at the top.
  for (let i = FAVORITE_SEED.length - 1; i >= 0; i--) {
    favStore.addFavoriteGene(FAVORITE_SEED[i])
  }

  const recentStore = useRecentGenes.getState()
  // Add in reverse so the first entry in RECENT_SEED ends up at the top.
  for (let i = RECENT_SEED.length - 1; i >= 0; i--) {
    recentStore.addRecentGene(RECENT_SEED[i])
  }

  // Set jobs directly rather than upserting so the seeded createdAt
  // timestamps (and their formatTimeAgo variety) are preserved.
  useJobHistory.setState((state) => {
    const seedIds = new Set(JOB_SEED.map((e) => e.id))
    return {
      entries: [
        ...JOB_SEED,
        ...state.entries.filter((e) => !seedIds.has(e.id)),
      ],
    }
  })

  return {
    favorites: FAVORITE_SEED.length,
    recents: RECENT_SEED.length,
    jobs: JOB_SEED.length,
  }
}
