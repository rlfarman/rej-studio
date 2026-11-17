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
// This runs both over every isoform in the committed sample corpus and over
// the crate's frozen DNAChisel fixtures. The Rust side is reached through the
// committed .wasm — the same module the browser runs — so the test needs no
// Rust toolchain, and `pnpm wasm:smoke` is what catches a stale module.
//
// Where they differ on purpose:
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
import { loadModule } from '../../../scripts/wasm-harness.mjs'

interface WggwReport {
  candidates: number[]
  by_distance: number[]
  inserted: {
    position: number
    motif: string
    distance_from_split: number
    original_codons: [string, string]
    new_codons: [string, string]
    recoded: string
  } | null
  split: { split_point: number; used_wggw_as_split: boolean }
}

const root = path.join(import.meta.dirname, '../../..')
const wggwReport = await loadModule(
  path.join(root, 'public/optimizer/rej-optimizer.wasm'),
).then((module) => module.wggwReport as (request: unknown) => WggwReport)

/** Every isoform coding sequence in the committed sample corpus. */
function sampleSequences(): { id: string; cds: string }[] {
  const directory = path.join(root, 'public/gene-data/sample/genes')
  return fs
    .readdirSync(directory)
    .flatMap((file) => {
      const gene = JSON.parse(
        fs.readFileSync(path.join(directory, file), 'utf8'),
      ) as {
        symbol: string
        isoforms: { id: string; codingSequence: string }[]
      }
      return gene.isoforms.map((isoform) => ({
        id: `${gene.symbol}/${isoform.id}`,
        cds: isoform.codingSequence,
      }))
    })
    .filter((entry) => entry.cds.length >= 6)
}

/** The crate's frozen DNAChisel recordings of the WGGW pipeline. */
function fixtureSequences(): { id: string; cds: string }[] {
  const fixtures = path.join(root, 'rust/optimizer/tests/fixtures')
  const pipeline = JSON.parse(
    fs.readFileSync(path.join(fixtures, 'pipeline.json'), 'utf8'),
  ) as { name: string; sequence: string }[]
  const genes = JSON.parse(
    fs.readFileSync(path.join(fixtures, 'real_genes.json'), 'utf8'),
  ) as { id: string; sequence: string }[]
  return [
    ...pipeline.map((entry) => ({ id: entry.name, cds: entry.sequence })),
    ...genes.map((entry) => ({ id: entry.id, cds: entry.sequence })),
  ]
}

const sequences = [...sampleSequences(), ...fixtureSequences()]

/**
 * The split points each sequence is checked at: the midpoint the UI defaults
 * to, the thirds the two-fragment default uses, and the ends.
 */
function splitPoints(length: number): number[] {
  return [
    1,
    Math.floor(length / 3),
    Math.floor(length / 2),
    Math.floor((length * 2) / 3),
    length - 1,
  ]
}

describe('WGGW candidate parity between TypeScript and the Rust crate', () => {
  it('has sequences to compare', () => {
    expect(sequences.length).toBeGreaterThan(200)
  })

  it('finds the same motifs in every sequence', () => {
    const disagreements: string[] = []
    for (const { id, cds } of sequences) {
      // TypeScript reports 1-based motif starts, the crate 0-based.
      const ours = findWggwMotifs(cds).map((motif) => motif.position - 1)
      const theirs = wggwReport({ sequence: cds }).candidates
      if (ours.join(',') !== theirs.join(',')) {
        disagreements.push(
          `${id}: ts ${ours.slice(0, 8).join(',')} vs rust ${theirs.slice(0, 8).join(',')}`,
        )
      }
    }
    expect(disagreements).toEqual([])
  })

  it('orders candidates the same way from the same reference point', () => {
    const disagreements: string[] = []
    for (const { id, cds } of sequences) {
      const motifs = findWggwMotifs(cds)
      for (const splitPoint of splitPoints(cds.length)) {
        // Both rank by absolute distance, ties keeping the earlier site; the
        // crate measures from the motif start, TypeScript from the cut, which
        // is two bases further on.
        const ours = motifs
          .map((motif) => motif.position - 1)
          .map((start, index) => ({ start, index }))
          .sort(
            (a, b) =>
              Math.abs(a.start - splitPoint) - Math.abs(b.start - splitPoint) ||
              a.index - b.index,
          )
          .map((entry) => entry.start)
        const theirs = wggwReport({
          sequence: cds,
          split_point: splitPoint,
        }).by_distance
        if (ours.join(',') !== theirs.join(',')) {
          disagreements.push(`${id} @${splitPoint}`)
        }
      }
    }
    expect(disagreements).toEqual([])
  })

  it('prefers the same existing motif for a balanced split', () => {
    const disagreements: string[] = []
    const ties: string[] = []
    for (const { id, cds } of sequences) {
      const ranked = rankWggwByBalance(cds)
      if (ranked.length === 0) continue
      // rankWggwByBalance ranks by distance from the midpoint; the crate
      // reaches the same cut from the midpoint minus the two bases between a
      // motif's start and the cut inside its GG.
      const reference = Math.round(cds.length / 2) - 2
      const theirCut =
        wggwReport({ sequence: cds, split_point: Math.max(0, reference) })
          .by_distance[0] + 2
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
        ties.push(`${id}: ${ranked[0].position} / ${theirCut}`)
        continue
      }
      disagreements.push(`${id}: ts ${ranked[0].position} vs rust ${theirCut}`)
    }
    expect(disagreements).toEqual([])
    // Ties are expected but rare; a jump in this number means the reference
    // points have drifted apart rather than the midpoint being ambiguous.
    expect(ties.length).toBeLessThan(sequences.length / 10)
  })

  it('agrees on which codon pairs can be recoded to carry a motif', () => {
    const disagreements: string[] = []
    for (const { id, cds } of sequences) {
      if (cds.length % 3 !== 0) continue
      const inducible = new Set(
        rankInducibleWggwByBalance(cds).map(
          (candidate) => candidate.hexamerStart - 1,
        ),
      )
      for (const splitPoint of splitPoints(cds.length)) {
        const { inserted } = wggwReport({
          sequence: cds,
          split_point: splitPoint,
        })
        if (!inserted) continue
        // The crate recodes one codon pair; the motif it creates sits inside
        // that pair, so the pair starts at the codon boundary at or before it.
        const hexamerStart = Math.floor(inserted.position / 3) * 3
        const candidates = [hexamerStart, hexamerStart - 3]
        if (!candidates.some((start) => inducible.has(start))) {
          disagreements.push(
            `${id} @${splitPoint}: rust recoded ${inserted.original_codons.join('+')} at ${hexamerStart}, which TypeScript does not offer`,
          )
        }
      }
    }
    expect(disagreements).toEqual([])
  })
})
