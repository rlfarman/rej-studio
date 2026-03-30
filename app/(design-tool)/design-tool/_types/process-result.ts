export interface WggwSiteInfo {
  position: number
  motif: string
  distance_from_split: number
  original_codons: [string, string]
  new_codons: [string, string]
}

export interface ProcessResult {
  name: string
  original_sequence: string
  optimized_sequence: string
  seq5: string
  seq3: string
  split_point: number
  used_wggw_as_split: boolean
  objectives_before: string
  objectives_after: string
  wggw_info: Record<string, WggwSiteInfo> | null
  processing_time_seconds: number
}
