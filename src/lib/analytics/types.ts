import type { SpeciesFilter } from '@/lib/bio/species'

// Window.dataLayer is declared by @next/third-parties/google (Object[]).

// ---------------------------------------------------------------------------
// Analytics events — discriminated union on `event`
// ---------------------------------------------------------------------------

export type AnalyticsEvent =
  | {
      event: 'gene_search'
      query: string
      species: SpeciesFilter
      result_count: number
    }
  | {
      event: 'gene_select'
      symbol: string
      species: string
      isoform_id?: string
    }
  | {
      event: 'isoform_view'
      gene_symbol: string
      gene_id: string
      isoform_count: number
    }
  | { event: 'job_submit'; job_id: string }
  | {
      event: 'job_complete'
      job_id: string
      sequence_length: number
      processing_time_seconds: number
    }
  | { event: 'job_failed'; job_id: string; error_code: string }
  | { event: 'sequence_download'; isoform_id: string }
  | { event: 'data_export' }
  | { event: 'data_import'; category_count: number }
  | {
      event: 'favorite_gene_toggle'
      gene_id: string
      symbol: string
      action: 'add' | 'remove'
    }
  | {
      event: 'species_filter_change'
      species: SpeciesFilter
      previous_species: SpeciesFilter
    }
  | { event: 'virtual_pageview'; page_path: string; page_search: string }
