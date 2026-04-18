import 'server-only'
import { unstable_cache } from 'next/cache'

export interface Exon {
  /** 1-based rank of the exon within the transcript. */
  rank: number
  /** Genomic start (Ensembl-style, 1-based inclusive). */
  start: number
  /** Genomic end (1-based inclusive). */
  end: number
}

export interface ExonStructure {
  strand: 1 | -1
  seqRegion: string
  exons: Exon[]
  /** Parsed from the transcript's exon set, sorted by CDS position. */
  cdsExonLengths: number[]
}

const ENSEMBL_BASE = 'https://rest.ensembl.org'
const USER_AGENT =
  'rej-studio/gene-map (+https://github.com/rlfarman/rej-studio)'

interface EnsemblExon {
  rank: number
  start: number
  end: number
  strand: 1 | -1
  seq_region_name: string
}

async function fetchExonStructureUncached(
  ensemblTranscriptId: string,
): Promise<ExonStructure | null> {
  try {
    const res = await fetch(
      `${ENSEMBL_BASE}/overlap/id/${encodeURIComponent(
        ensemblTranscriptId,
      )}?feature=exon;content-type=application/json`,
      {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(4000),
      },
    )
    if (!res.ok) return null
    const exons = (await res.json()) as EnsemblExon[]
    if (!exons?.length) return null

    const strand = exons[0].strand
    const seqRegion = exons[0].seq_region_name

    const sorted = [...exons].sort((a, b) =>
      strand === 1 ? a.rank - b.rank : a.rank - b.rank,
    )
    const cdsExonLengths = sorted.map((e) => e.end - e.start + 1)

    return {
      strand,
      seqRegion,
      exons: sorted.map((e) => ({ rank: e.rank, start: e.start, end: e.end })),
      cdsExonLengths,
    }
  } catch {
    return null
  }
}

export async function fetchExonStructure(
  ensemblTranscriptId: string,
): Promise<ExonStructure | null> {
  return unstable_cache(
    () => fetchExonStructureUncached(ensemblTranscriptId),
    ['ensembl-exons', ensemblTranscriptId],
    { revalidate: 86400, tags: [`ensembl:${ensemblTranscriptId}`] },
  )()
}
