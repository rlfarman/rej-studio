// Does the TypeScript WGGW logic agree with the Rust crate's?
//
// Two implementations rank WGGW split sites. TypeScript's
// (`findWggwMotifs`, `rankWggwByBalance`, `rankInducibleWggwByBalance`) runs
// synchronously on gene pages, which never load the optimizer; the crate's
// (`candidate_splice_sites`, `by_distance_from`, `insert_wggw_motif`,
// `split_sequence`) decides where a design is actually cut. They overlap, and
// where they overlap they have to agree, or the slider shows a split the
// optimizer will not use.
//
// The crate's side is the committed reference in
// `rust/optimizer/tests/fixtures/wggw_reference.json`, written by
// `cargo run --release --example wggw-reference` over every isoform in the
// sample corpus and the crate's frozen DNAChisel fixtures. Reading a file
// rather than the module keeps this test free of Rust *and* of WebAssembly —
// an export for it would be download weight for every visitor — and Rust CI
// regenerates the reference and fails if it has gone stale.
//
// Where the two differ on purpose:
//
//   * **The reference point.** TypeScript ranks by distance from the
//     midpoint, because the gene page asks "which cut gives the most balanced
//     halves?". The crate ranks by distance from the *requested* split point,
//     because the user may have moved it. Give both the same reference and
//     the orderings have to match, which is what this checks.
//   * **Which synonymous rewrite.** For a codon pair that can be recoded to
//     carry a motif, TypeScript offers every rewrite and leads with the one
//     changing fewest bases (the picker shows them all); the crate takes the
//     first pair in its dipeptide table, because nothing is choosing. The
//     *positions* they consider recodable must still agree, and a rewrite the
//     user picks is sent as `selected_wggw_site` and applied verbatim.

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vite-plus/test'

import {
  findWggwMotifs,
  rankInducibleWggwByBalance,
  rankWggwByBalance,
} from './sequence-utils'

/** One sequence's answers, as the crate gave them. */
interface ReferenceEntry {
  id: string
  length: number
  /** 0-based starts of every WGGW motif. */
  candidates: number[]
  /** Keyed by the split point the crate was asked about. */
  at: Record<
    string,
    {
      /** The nearest candidates, in the crate's distance order. */
      nearest: number[]
      inserted: {
        position: number
        motif: string
        original_codons: [string, string]
        new_codons: [string, string]
      } | null
      split: { split_point: number; used_wggw_as_split: boolean }
    }
  >
}

const reference = JSON.parse(
  fs.readFileSync(
    path.join(
      import.meta.dirname,
      '../../../rust/optimizer/tests/fixtures/wggw_reference.json',
    ),
    'utf8',
  ),
) as { order_prefix: number; entries: ReferenceEntry[] }

/**
 * The sequences the reference was taken from, by id.
 *
 * The reference records positions, not sequences, so the inputs come from the
 * same two places the example read them from.
 */
function sequencesById(): Map<string, string> {
  const root = path.join(import.meta.dirname, '../../..')
  const sequences = new Map<string, string>()

  const genes = path.join(root, 'public/gene-data/sample/genes')
  for (const file of fs.readdirSync(genes)) {
    const gene = JSON.parse(
      fs.readFileSync(path.join(genes, file), 'utf8'),
    ) as {
      symbol: string
      isoforms: { id: string; codingSequence: string }[]
    }
    for (const isoform of gene.isoforms) {
      sequences.set(`${gene.symbol}/${isoform.id}`, isoform.codingSequence)
    }
  }

  const fixtures = path.join(root, 'rust/optimizer/tests/fixtures')
  const read = (name: string, key: 'name' | 'id') => {
    const cases = JSON.parse(
      fs.readFileSync(path.join(fixtures, name), 'utf8'),
    ) as Record<string, string>[]
    for (const entry of cases) sequences.set(entry[key], entry.sequence)
  }
  read('pipeline.json', 'name')
  read('real_genes.json', 'id')

  return sequences
}

const sequences = sequencesById()

/** Every reference entry with the sequence it was taken from. */
const cases = reference.entries.map((entry) => {
  const cds = sequences.get(entry.id)
  if (cds === undefined) {
    throw new Error(
      `${entry.id} is in the WGGW reference but not in the corpus or fixtures — regenerate it with \`cargo run --release --example wggw-reference\``,
    )
  }
  return { entry, cds }
})

describe('WGGW candidate parity between TypeScript and the Rust crate', () => {
  it('has the whole corpus to compare, at the length the crate saw', () => {
    expect(cases.length).toBeGreaterThan(200)
    expect(
      cases.filter(({ entry, cds }) => cds.length !== entry.length),
    ).toEqual([])
  })

  it('finds the same motifs in every sequence', () => {
    const disagreements: string[] = []
    for (const { entry, cds } of cases) {
      // TypeScript reports 1-based motif starts, the crate 0-based.
      const ours = findWggwMotifs(cds).map((motif) => motif.position - 1)
      if (ours.join(',') !== entry.candidates.join(',')) {
        disagreements.push(
          `${entry.id}: ts ${ours.slice(0, 8).join(',')} vs rust ${entry.candidates.slice(0, 8).join(',')}`,
        )
      }
    }
    expect(disagreements).toEqual([])
  })

  it('orders candidates the same way from the same reference point', () => {
    const disagreements: string[] = []
    for (const { entry, cds } of cases) {
      const starts = findWggwMotifs(cds).map((motif) => motif.position - 1)
      for (const [key, at] of Object.entries(entry.at)) {
        const splitPoint = Number(key)
        // Both rank by absolute distance, ties keeping the earlier site; the
        // crate measures from the motif start, TypeScript from the cut, which
        // is two bases further on.
        const ours = starts
          .map((start, index) => ({ start, index }))
          .sort(
            (a, b) =>
              Math.abs(a.start - splitPoint) - Math.abs(b.start - splitPoint) ||
              a.index - b.index,
          )
          .map((candidate) => candidate.start)
          .slice(0, reference.order_prefix)
        if (ours.join(',') !== at.nearest.join(',')) {
          disagreements.push(
            `${entry.id} @${splitPoint}: ts ${ours.join(',')} vs rust ${at.nearest.join(',')}`,
          )
        }
      }
    }
    expect(disagreements).toEqual([])
  })

  it('prefers the same existing motif for a balanced split', () => {
    const disagreements: string[] = []
    const ties: string[] = []
    for (const { entry, cds } of cases) {
      const ranked = rankWggwByBalance(cds)
      if (ranked.length === 0) continue
      // rankWggwByBalance ranks by distance from the midpoint; the crate
      // reaches the same cut from the midpoint minus the two bases between a
      // motif's start and the cut inside its GG.
      const reference = Math.max(0, Math.round(cds.length / 2) - 2)
      const at = entry.at[String(reference)]
      if (!at) {
        throw new Error(
          `the WGGW reference has no entry for ${entry.id} @${reference}`,
        )
      }
      const theirCut = at.nearest[0] + 2
      if (theirCut === ranked[0].position) continue

      // An odd length puts the midpoint half a base from every position, so
      // two motifs can be exactly as balanced as each other while the
      // integer reference the crate works from is nearer one of them. That
      // is the only disagreement there is, and both answers are equally
      // balanced — so require that, rather than the same pick.
      const distance = (cut: number) => Math.abs(cut - cds.length / 2)
      if (
        cds.length % 2 !== 0 &&
        distance(theirCut) === distance(ranked[0].position)
      ) {
        ties.push(`${entry.id}: ${ranked[0].position} / ${theirCut}`)
        continue
      }
      disagreements.push(
        `${entry.id}: ts ${ranked[0].position} vs rust ${theirCut}`,
      )
    }
    expect(disagreements).toEqual([])
    // Ties are expected but rare; a jump in this number means the reference
    // points have drifted apart rather than the midpoint being ambiguous.
    expect(ties.length).toBeLessThan(cases.length / 10)
  })

  it('agrees on which codon pairs can be recoded to carry a motif', () => {
    const disagreements: string[] = []
    for (const { entry, cds } of cases) {
      if (cds.length % 3 !== 0) continue
      const inducible = new Set(
        rankInducibleWggwByBalance(cds).map(
          (candidate) => candidate.hexamerStart - 1,
        ),
      )
      for (const [key, at] of Object.entries(entry.at)) {
        if (!at.inserted) continue
        // The crate recodes one codon pair; the motif it creates sits inside
        // that pair, so the pair starts at the codon boundary at or before it.
        const hexamerStart = Math.floor(at.inserted.position / 3) * 3
        const candidates = [hexamerStart, hexamerStart - 3]
        if (!candidates.some((start) => inducible.has(start))) {
          disagreements.push(
            `${entry.id} @${key}: rust recoded ${at.inserted.original_codons.join('+')} at ${hexamerStart}, which TypeScript does not offer`,
          )
        }
      }
    }
    expect(disagreements).toEqual([])
  })
})
