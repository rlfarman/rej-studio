import {
  CORPUS_FORMAT,
  INDEX_PATH,
  geneFilePath,
  transcriptShardOf,
  transcriptShardPath,
  type CorpusGene,
  type CorpusIsoform,
  type GeneFile,
  symbolShardKey,
  symbolShardPath,
  type GeneIndexFile,
  type GeneTable,
  type TranscriptShard,
} from './format'
import { selectIdentityIsoforms, triangleSize } from './identity'

/** An isoform row as the JSONL seed has it: with its gene's id. */
export type SeedIsoform = CorpusIsoform & { geneId: string }

/**
 * Gene id → the upper triangle of its isoform identities in tenths of a
 * percent (`StoredIsoformIdentity.permille`), for the isoforms
 * `identityInputs` listed. Computed by the Rust crate, which the pure build
 * below can't call; genes with fewer than two isoforms may be left out.
 */
export type IsoformIdentities = ReadonlyMap<string, readonly number[]>

/**
 * What the corpus build hands the aligner: for each gene with at least two
 * isoforms, their protein sequences in the order the matrix shows them.
 * Uses the same selection as the page, so the aligner never needs to know
 * it.
 */
export function identityInputs(
  seedIsoforms: readonly SeedIsoform[],
): Map<string, string[]> {
  const byGene = new Map<string, SeedIsoform[]>()
  for (const isoform of seedIsoforms) {
    // No gene id: dropped by buildCorpus, so not worth aligning.
    if (isoform.geneId === '') continue
    const rows = byGene.get(isoform.geneId)
    if (rows) rows.push(isoform)
    else byGene.set(isoform.geneId, [isoform])
  }
  const inputs = new Map<string, string[]>()
  for (const [geneId, isoforms] of byGene) {
    const shown = selectIdentityIsoforms(isoforms)
    if (shown.length >= 2) {
      inputs.set(
        geneId,
        shown.map((isoform) => isoform.proteinSequence),
      )
    }
  }
  return inputs
}

/**
 * Transcripts per lookup shard. A search for a transcript id fetches one
 * shard, so this trades shard count against the bytes one lookup costs.
 */
const TRANSCRIPTS_PER_SHARD = 2000

// Ensembl stable ids. Anything else would make an odd file name.
const SAFE_ID = /^[A-Za-z0-9._-]+$/

export interface BuiltCorpus {
  /** Relative path → file contents. */
  files: Map<string, string>
  geneCount: number
  isoformCount: number
  /** Genes skipped for having no id. */
  skippedGenes: number
  /** Isoforms skipped because no kept gene owns them. */
  orphanIsoforms: number
}

const byId = (a: { id: string }, b: { id: string }) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0

/**
 * Turn the JSONL seed into the static corpus (see format.ts). Pure and
 * deterministic: the same input always gives byte-identical files, so the
 * committed sample can be checked against a rebuild.
 *
 * Rows without a gene id are dropped along with the isoforms filed under
 * them. The full corpus has one such placeholder gene holding 14k
 * transcripts that no gene claims; Postgres search surfaced them as results
 * with a blank symbol that linked nowhere.
 */
export function buildCorpus(
  seedGenes: readonly CorpusGene[],
  seedIsoforms: readonly SeedIsoform[],
  version: string,
  identities: IsoformIdentities,
): BuiltCorpus {
  const genes = seedGenes.filter((gene) => gene.id !== '').sort(byId)
  const skippedGenes = seedGenes.length - genes.length

  const isoformsByGene = new Map<string, CorpusIsoform[]>(
    genes.map((gene) => {
      if (!SAFE_ID.test(gene.id)) {
        throw new Error(`Gene id ${JSON.stringify(gene.id)} is not file-safe`)
      }
      return [gene.id, []]
    }),
  )
  if (isoformsByGene.size !== genes.length) {
    throw new Error('Duplicate gene ids in the seed')
  }

  let orphanIsoforms = 0
  const transcripts: [string, string][] = []
  for (const { geneId, ...isoform } of seedIsoforms) {
    const owner = isoformsByGene.get(geneId)
    if (!owner) {
      orphanIsoforms++
      continue
    }
    owner.push({
      id: isoform.id,
      codingSequenceLength: isoform.codingSequenceLength,
      proteinSequenceLength: isoform.proteinSequenceLength,
      codingSequence: isoform.codingSequence,
      proteinSequence: isoform.proteinSequence,
      species: isoform.species,
    })
    transcripts.push([isoform.id, geneId])
  }

  const files = new Map<string, string>()

  for (const gene of genes) {
    const isoforms = isoformsByGene.get(gene.id)!.sort(byId)
    const shown = selectIdentityIsoforms(isoforms).map(({ id }) => id)
    const permille = identities.get(gene.id) ?? []
    // Every gene gets the field, even with one isoform, so its absence
    // always means "built before identities were stored".
    if (permille.length !== triangleSize(shown.length)) {
      throw new Error(
        `Gene ${gene.id}: ${permille.length} identities for ${shown.length} isoforms (expected ${triangleSize(shown.length)})`,
      )
    }
    const file: GeneFile = {
      id: gene.id,
      symbol: gene.symbol,
      name: gene.name,
      species: gene.species,
      alternateSymbols: gene.alternateSymbols,
      isoforms,
      isoformIdentity: { isoforms: shown, permille: [...permille] },
    }
    files.set(geneFilePath(gene.id), JSON.stringify(file))
  }

  const shardCount = Math.max(
    1,
    Math.ceil(transcripts.length / TRANSCRIPTS_PER_SHARD),
  )
  const shards: TranscriptShard[] = Array.from(
    { length: shardCount },
    () => ({}),
  )
  transcripts.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  for (const [transcriptId, geneId] of transcripts) {
    shards[transcriptShardOf(transcriptId, shardCount)][transcriptId] = geneId
  }
  shards.forEach((shard, n) => {
    files.set(transcriptShardPath(n), JSON.stringify(shard))
  })

  const species = [...new Set(genes.map((gene) => gene.species))].sort()
  const table = (rows: CorpusGene[]): GeneTable => ({
    format: CORPUS_FORMAT,
    version,
    species,
    genes: {
      id: rows.map((gene) => gene.id),
      symbol: rows.map((gene) => gene.symbol),
      name: rows.map((gene) => gene.name),
      species: rows.map((gene) => species.indexOf(gene.species)),
      alternateSymbols: rows.map((gene) => gene.alternateSymbols),
    },
  })
  const index: GeneIndexFile = {
    ...table(genes),
    geneCount: genes.length,
    isoformCount: transcripts.length,
    transcriptShards: shardCount,
  }
  files.set(INDEX_PATH, JSON.stringify(index))

  // Genes with no symbol can't be looked up by one, so no shard holds them.
  const bySymbolKey = new Map<string, CorpusGene[]>()
  for (const gene of genes) {
    if (gene.symbol === '') continue
    const key = symbolShardKey(gene.symbol)
    const rows = bySymbolKey.get(key)
    if (rows) rows.push(gene)
    else bySymbolKey.set(key, [gene])
  }
  for (const key of [...bySymbolKey.keys()].sort()) {
    files.set(
      symbolShardPath(key),
      JSON.stringify(table(bySymbolKey.get(key)!)),
    )
  }

  return {
    files,
    geneCount: genes.length,
    isoformCount: transcripts.length,
    skippedGenes,
    orphanIsoforms,
  }
}
