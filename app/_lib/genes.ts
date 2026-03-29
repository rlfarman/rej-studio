import type { Gene } from '@/types/gene'
import type { Isoform } from '@/types/isoform'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { getDb } from './db'

const DATA_PATH = path.join(process.cwd(), 'public', 'data')

interface GeneRow {
  symbol: string
  name: string
  ensg: string
  chromosome: string
}

interface IsoformRow {
  enst: string
  gene_symbol: string
  length: number
  packagability: number
  species: string
}

interface DiseaseRow {
  gene_symbol: string
  disease: string
}

interface SequenceRow {
  coding_sequence: string
  protein_sequence: string
}

function toGene(
  row: GeneRow,
  isoformRows: IsoformRow[],
  diseaseRows: DiseaseRow[]
): Gene {
  return {
    symbol: row.symbol,
    name: row.name,
    ENSG: row.ensg as Gene['ENSG'],
    chromosome: row.chromosome,
    isoforms: isoformRows.map((r) => ({
      ENST: r.enst as Isoform['ENST'],
      length: r.length,
      packagability: r.packagability,
      species: r.species as Isoform['species'],
    })),
    diseaseAssociations:
      diseaseRows.length > 0 ? diseaseRows.map((r) => r.disease) : null,
  }
}

function hydrateGene(row: GeneRow): Gene {
  const db = getDb()
  const isoformRows = db
    .prepare('SELECT * FROM isoforms WHERE gene_symbol = ?')
    .all(row.symbol) as IsoformRow[]
  const diseaseRows = db
    .prepare('SELECT disease FROM disease_associations WHERE gene_symbol = ?')
    .all(row.symbol) as (DiseaseRow & { gene_symbol: string })[]
  return toGene(row, isoformRows, diseaseRows)
}

export function getAllGenes(): Gene[] {
  const db = getDb()

  const geneRows = db.prepare('SELECT * FROM genes').all() as GeneRow[]
  const allIsoforms = db.prepare('SELECT * FROM isoforms').all() as IsoformRow[]
  const allDiseases = db
    .prepare('SELECT gene_symbol, disease FROM disease_associations')
    .all() as DiseaseRow[]

  const isoformsByGene = new Map<string, IsoformRow[]>()
  for (const row of allIsoforms) {
    const list = isoformsByGene.get(row.gene_symbol)
    if (list) list.push(row)
    else isoformsByGene.set(row.gene_symbol, [row])
  }

  const diseasesByGene = new Map<string, DiseaseRow[]>()
  for (const row of allDiseases) {
    const list = diseasesByGene.get(row.gene_symbol)
    if (list) list.push(row)
    else diseasesByGene.set(row.gene_symbol, [row])
  }

  return geneRows.map((row) =>
    toGene(
      row,
      isoformsByGene.get(row.symbol) ?? [],
      diseasesByGene.get(row.symbol) ?? []
    )
  )
}

export function findGeneBySymbol(symbol: string): Gene | undefined {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM genes WHERE symbol = ?')
    .get(symbol) as GeneRow | undefined
  if (!row) return undefined
  return hydrateGene(row)
}

export function searchGenes(query: string, limit = 100) {
  const db = getDb()

  if (query === '') {
    const rows = db
      .prepare('SELECT * FROM genes LIMIT ?')
      .all(limit) as GeneRow[]
    const total = (
      db.prepare('SELECT COUNT(*) as count FROM genes').get() as {
        count: number
      }
    ).count
    return {
      genes: rows.map(hydrateGene),
      hasMore: total > limit,
    }
  }

  const pattern = `%${query}%`
  const rows = db
    .prepare(
      `SELECT DISTINCT g.* FROM genes g
       LEFT JOIN isoforms i ON i.gene_symbol = g.symbol
       WHERE g.symbol LIKE ? OR g.name LIKE ? OR i.enst LIKE ?
       LIMIT ?`
    )
    .all(pattern, pattern, pattern, limit + 1) as GeneRow[]

  return {
    genes: rows.slice(0, limit).map(hydrateGene),
    hasMore: rows.length > limit,
  }
}

export function loadIsoformSequences(isoform: Isoform): Isoform {
  const db = getDb()
  const row = db
    .prepare('SELECT coding_sequence, protein_sequence FROM sequences WHERE enst = ?')
    .get(isoform.ENST) as SequenceRow | undefined

  if (!row) return isoform

  return {
    ...isoform,
    codingSequence: row.coding_sequence || undefined,
    proteinSequence: row.protein_sequence || undefined,
  }
}

export function loadCodingSequence(enst: string): string {
  const db = getDb()
  const row = db
    .prepare('SELECT coding_sequence FROM sequences WHERE enst = ?')
    .get(enst) as { coding_sequence: string } | undefined
  return row?.coding_sequence ?? ''
}

export async function hasPrecomputedZip(
  symbol: string,
  enst: string
): Promise<boolean> {
  try {
    await fs.access(
      path.join(DATA_PATH, 'precomputed', `REJ_${symbol}_${enst}.zip`)
    )
    return true
  } catch {
    return false
  }
}

export function getGeneWithSequences(symbol: string): Gene | undefined {
  const gene = findGeneBySymbol(symbol)
  if (!gene) return undefined
  return {
    ...gene,
    isoforms: gene.isoforms.map(loadIsoformSequences),
  }
}
