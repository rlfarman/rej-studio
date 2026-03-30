import type { FormValues } from '../_components/form-schema'

export interface PresetConfig {
  label: string
  description: string
  values: Partial<
    Pick<
      FormValues,
      | 'removeCrypticSpliceSites'
      | 'removeCrypticSpliceSitesWeight'
      | 'minimizeCpgs'
      | 'minimizeCpgsWeight'
      | 'reduceKmerComplexity'
      | 'reduceKmerComplexityWeight'
      | 'enforceGcContent'
      | 'codonOptimizeWeight'
    >
  >
}

export const PRESETS: Record<string, PresetConfig> = {
  conservative: {
    label: 'Conservative',
    description:
      'Minimal changes. Removes cryptic splice sites and enforces GC range but leaves other objectives off.',
    values: {
      removeCrypticSpliceSites: true,
      removeCrypticSpliceSitesWeight: 1,
      minimizeCpgs: false,
      minimizeCpgsWeight: 1,
      reduceKmerComplexity: false,
      reduceKmerComplexityWeight: 1,
      enforceGcContent: true,
      codonOptimizeWeight: 1,
    },
  },
  balanced: {
    label: 'Balanced',
    description:
      'All optimizations enabled at moderate weight. A good starting point for most designs.',
    values: {
      removeCrypticSpliceSites: true,
      removeCrypticSpliceSitesWeight: 1,
      minimizeCpgs: true,
      minimizeCpgsWeight: 1,
      reduceKmerComplexity: true,
      reduceKmerComplexityWeight: 1,
      enforceGcContent: true,
      codonOptimizeWeight: 1,
    },
  },
  lowCpg: {
    label: 'Low CpG',
    description:
      'Aggressively minimizes CpG sites to reduce silencing risk from DNA methylation.',
    values: {
      removeCrypticSpliceSites: true,
      removeCrypticSpliceSitesWeight: 1,
      minimizeCpgs: true,
      minimizeCpgsWeight: 10,
      reduceKmerComplexity: true,
      reduceKmerComplexityWeight: 1,
      enforceGcContent: true,
      codonOptimizeWeight: 1,
    },
  },
  aavConstrained: {
    label: 'AAV-Constrained',
    description:
      'Balanced optimization with emphasis on reducing sequence length and synthesis complexity for AAV packaging.',
    values: {
      removeCrypticSpliceSites: true,
      removeCrypticSpliceSitesWeight: 2,
      minimizeCpgs: true,
      minimizeCpgsWeight: 2,
      reduceKmerComplexity: true,
      reduceKmerComplexityWeight: 3,
      enforceGcContent: true,
      codonOptimizeWeight: 1,
    },
  },
  expert: {
    label: 'Expert',
    description: 'No preset applied. All controls are available for manual tuning.',
    values: {},
  },
}

export const PRESET_KEYS = Object.keys(PRESETS) as (keyof typeof PRESETS)[]
