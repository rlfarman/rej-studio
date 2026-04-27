import { getRelativePreference } from '@/lib/bio/codon-usage'
import { translateCodon } from '@/lib/bio/genetic-code'
import type { Species } from '@/lib/bio/species'
import type {
  RankedInducibleWggwCandidate,
  WggwRecodingOption,
} from '@/lib/bio/sequence-utils'
import type { CodonRole, SequenceContext, WggwSiteCandidate } from './types'

// Score a rewrite option as the product of its codons' relative
// preferences in the host's codon-usage table. Result in [0, 1] where
// 1 = both codons are the most-preferred synonyms for their AA. Returns
// null when the host isn't picked (species === 'none' or unknown) or
// the codons aren't in the table.
export function scoreRewriteOption(
  option: WggwRecodingOption,
  species: Species | 'none',
): number | null {
  if (species === 'none') return null
  const a = getRelativePreference(option.newCodons[0], species)
  const b = getRelativePreference(option.newCodons[1], species)
  if (a === null || b === null) return null
  return a * b
}

export function buildSegments(
  positions: number[],
  seqLen: number,
): Array<{ start: number; end: number; label: string }> {
  if (positions.length === 0) {
    return [{ start: 0, end: seqLen, label: 'sequence' }]
  }
  const segs: Array<{ start: number; end: number; label: string }> = []
  let prev = 0
  positions.forEach((pos, i) => {
    // Inner segments don't need a "midN" label — the 5′ / 3′ ends are
    // self-evident from position; everything between them is just "more
    // of the gene".
    const label = i === 0 ? '5′' : ''
    segs.push({ start: prev, end: pos, label })
    prev = pos
  })
  segs.push({ start: prev, end: seqLen, label: '3′' })
  return segs
}

export function buildSequenceContext(sequence: string): SequenceContext {
  const upper = sequence.toUpperCase().replace(/U/g, 'T')
  const seqLen = upper.length
  const start = 1
  const end = seqLen
  const totalCodons = Math.ceil(seqLen / 3)
  const lastCodonIdx = totalCodons - 1
  const bases: SequenceContext['bases'] = []

  for (let pos = 1; pos <= seqLen; pos++) {
    const codonIdx = Math.floor((pos - 1) / 3)
    const codonStart = codonIdx * 3 + 1
    const codon = upper.slice(codonStart - 1, codonStart + 2)
    const aa = codon.length === 3 ? translateCodon(codon) : null
    let role: CodonRole = 'context'
    if (codonStart === 1) role = 'start'
    else if (codonIdx === lastCodonIdx && aa === '*') role = 'stop'
    else if (aa === '*') role = 'internal-stop'
    bases.push({ base: upper[pos - 1] ?? '.', position: pos, role })
  }

  const codons: SequenceContext['codons'] = []
  for (let idx = 0; idx < totalCodons; idx++) {
    const codonStart = idx * 3 + 1
    const codonEnd = Math.min(codonStart + 2, seqLen)
    const codon = upper.slice(codonStart - 1, codonEnd)
    const aa = codon.length === 3 ? translateCodon(codon) : null
    let role: CodonRole = 'context'
    if (codonStart === 1) role = 'start'
    else if (idx === lastCodonIdx && aa === '*') role = 'stop'
    else if (aa === '*') role = 'internal-stop'
    codons.push({ codon, aa, idx, start: codonStart, end: codonEnd, role })
  }

  return { start, end, bases, codons }
}

export function splitPositionToPercent(
  position: number,
  sequenceLength: number,
) {
  if (sequenceLength <= 0) return 0
  return (position / sequenceLength) * 100
}

export function findSequenceMatches(sequence: string, query: string) {
  if (!query) return []
  const matches: Array<{ start: number; length: number }> = []
  let startIndex = 0
  while (startIndex < sequence.length) {
    const foundIndex = sequence.indexOf(query, startIndex)
    if (foundIndex === -1) break
    matches.push({ start: foundIndex + 1, length: query.length })
    startIndex = foundIndex + 1
  }
  return matches
}

// Pick the top N WGGW sites for a given splice slot. Suggestions are
// ranked primarily by how close each site is to an "ideal" position for
// that splice — the midpoint for single-splice, ~1/3 for splice 1 and
// ~2/3 for splice 2 in a multi-splice configuration. Native sites get
// a small score bonus so they edge out adjacent non-native sites of
// similar position. Sites already selected on the other splice are
// excluded.
//
// The dominance of position-distance is intentional: a splice point
// near an extreme of the sequence is rarely useful regardless of how
// little modification it requires; biasing on position keeps the
// suggestions in the region the user is plausibly going to pick from.
export function pickTopSites(
  sites: WggwSiteCandidate[],
  selectedPositions: (number | null)[],
  spliceIndex: number,
  count: number,
): WggwSiteCandidate[] {
  const otherSelected = new Set(
    selectedPositions
      .map((p, i) => (i === spliceIndex ? null : p))
      .filter((p): p is number => p !== null),
  )
  const isMultiSplice = selectedPositions.length > 1
  const seqLength =
    sites.length > 0 ? Math.max(...sites.map((s) => s.position)) : 0
  const idealFraction = isMultiSplice
    ? spliceIndex === 0
      ? 1 / 3
      : 2 / 3
    : 1 / 2
  const idealPosition = seqLength * idealFraction
  return sites
    .filter((s) => !otherSelected.has(s.position))
    .map((site) => {
      // Distance from ideal as a fraction of seq length (in [0, 0.5]).
      const distance =
        Math.abs(site.position - idealPosition) / Math.max(1, seqLength)
      // Native sites get a 0.04 score advantage — enough to pull them
      // ahead of non-native sites within ~120 bp on a 3 kb sequence,
      // not enough to surface an edge-of-sequence native over a
      // mid-sequence non-native.
      const nativeBonus = site.baseChanges === 0 ? -0.04 : 0
      return { site, score: distance + nativeBonus }
    })
    .sort((a, b) => a.score - b.score || a.site.position - b.site.position)
    .slice(0, count)
    .map((entry) => entry.site)
}

export function nearestSiteIndex(
  sites: WggwSiteCandidate[],
  position: number,
): number {
  if (sites.length === 0) return -1
  let bestIdx = 0
  let bestDist = Math.abs(sites[0].position - position)
  for (let i = 1; i < sites.length; i++) {
    const d = Math.abs(sites[i].position - position)
    if (d < bestDist) {
      bestDist = d
      bestIdx = i
    }
  }
  return bestIdx
}

export function dedupeRewriteOptions(options: WggwRecodingOption[]) {
  const seen = new Set<string>()
  return options.filter((option) => {
    const key = `${option.motif}|${option.newHexamer}|${option.motifOffset}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function groupWggwSites(
  candidates: RankedInducibleWggwCandidate[],
): WggwSiteCandidate[] {
  const byPosition = new Map<number, RankedInducibleWggwCandidate[]>()
  for (const candidate of candidates) {
    const group = byPosition.get(candidate.position)
    if (group) group.push(candidate)
    else byPosition.set(candidate.position, [candidate])
  }

  return [...byPosition.values()]
    .map((group) => {
      const representative = [...group].sort((a, b) => {
        if (a.alreadyPresent !== b.alreadyPresent) {
          return a.alreadyPresent ? -1 : 1
        }
        if (a.baseChanges !== b.baseChanges)
          return a.baseChanges - b.baseChanges
        return a.newHexamer.localeCompare(b.newHexamer)
      })[0]
      const rewriteOptions = dedupeRewriteOptions(
        group.flatMap((candidate) => candidate.rewriteOptions),
      ).sort((a, b) => {
        if (a.baseChanges !== b.baseChanges)
          return a.baseChanges - b.baseChanges
        return a.newHexamer.localeCompare(b.newHexamer)
      })
      const primary = rewriteOptions[0]
      return {
        ...representative,
        newHexamer: primary?.newHexamer ?? representative.newHexamer,
        newCodons: primary?.newCodons ?? representative.newCodons,
        baseChanges: primary?.baseChanges ?? representative.baseChanges,
        alreadyPresent:
          (primary?.baseChanges ?? representative.baseChanges) === 0,
        rewriteOptions,
      }
    })
    .sort((a, b) => a.position - b.position)
}

export function applyRewriteToSequence(
  sequence: string,
  hexamerStart: number,
  newHexamer: string,
) {
  const startIndex = hexamerStart - 1
  return (
    sequence.slice(0, startIndex) +
    newHexamer +
    sequence.slice(startIndex + newHexamer.length)
  )
}

export function buildSplitContext(
  sequence: string,
  position: number,
  motifStart: number,
  editedPositions: Set<number>,
) {
  const leftStart = Math.max(1, position - 15)
  const rightEnd = Math.min(sequence.length, position + 14)
  const left = sequence.slice(leftStart - 1, position - 1)
  const right = sequence.slice(position - 1, rightEnd)
  const text = `${left}|${right}`
  const displayText = `...${text}...`
  const boundaryIndexes = getCodonBoundaryDisplayIndexes(
    leftStart,
    rightEnd,
    position,
    3,
  )
  const highlightStart = Math.max(0, motifStart - leftStart)
  const highlightEnd = Math.min(text.length, highlightStart + 5)
  const editedIndexes = [...editedPositions]
    .filter((pos) => pos >= leftStart && pos <= rightEnd)
    .map((pos) => pos - leftStart)
  const displayEditedIndexes = editedIndexes.map((index) =>
    index >= position - leftStart ? index + 4 : index + 3,
  )
  return {
    text,
    displayText,
    boundaryIndexes,
    highlightStart,
    highlightEnd,
    editedIndexes,
    displayEditedIndexes,
    windowStart: leftStart,
    windowEnd: rightEnd,
  }
}

export function buildAminoAcidGuide(
  sequence: string,
  windowStart: number,
  windowEnd: number,
  splitPosition: number,
) {
  const upper = sequence.toUpperCase().replace(/U/g, 'T')
  return formatAminoAcidGuideText(upper, windowStart, windowEnd, splitPosition)
}

function formatAminoAcidGuideText(
  sequence: string,
  windowStart: number,
  windowEnd: number,
  splitPosition: number,
) {
  const coreText = buildDisplayCoreText(windowStart, windowEnd, splitPosition)
  const chars: string[] = [...`...${coreText}...`].map((char) =>
    char === '|' ? '|' : ' ',
  )
  const boundaryIndexes = getCodonBoundaryDisplayIndexes(
    windowStart,
    windowEnd,
    splitPosition,
    3,
  )
  const firstCodonStart = Math.floor((windowStart - 1) / 3) * 3 + 1
  for (
    let codonStart = firstCodonStart;
    codonStart <= windowEnd - 2;
    codonStart += 3
  ) {
    const codonEnd = codonStart + 2
    if (codonStart < windowStart || codonEnd > windowEnd) continue
    const aa = translateCodon(sequence.slice(codonStart - 1, codonEnd)) ?? '.'
    const midpoint = codonStart + 1
    const displayIndex = getDisplayIndexForPosition(
      midpoint,
      windowStart,
      splitPosition,
    )
    chars[displayIndex] = aa
  }
  return { text: chars.join(''), boundaryIndexes }
}

export function buildMotifGuide(
  displayText: string,
  boundaryIndexes: number[],
) {
  const chars: string[] = [...displayText].map(() => ' ')
  const splitIndex = displayText.indexOf('|')
  if (splitIndex === -1) {
    return { text: chars.join(''), boundaryIndexes }
  }
  chars[splitIndex - 2] = 'W'
  chars[splitIndex - 1] = 'G'
  chars[splitIndex] = '|'
  chars[splitIndex + 1] = 'G'
  chars[splitIndex + 2] = 'W'
  return { text: chars.join(''), boundaryIndexes }
}

function getDisplayIndexForPosition(
  position: number,
  windowStart: number,
  splitPosition: number,
) {
  let index = 3
  for (let pos = windowStart; pos < position; pos++) {
    if (pos === splitPosition) index++
    index++
  }
  if (position === splitPosition) index++
  return index
}

function buildDisplayCoreText(
  windowStart: number,
  windowEnd: number,
  splitPosition: number,
) {
  const chars: string[] = []
  for (let pos = windowStart; pos <= windowEnd; pos++) {
    if (pos === splitPosition) chars.push('|')
    chars.push(' ')
  }
  return chars.join('')
}

function getCodonBoundaryDisplayIndexes(
  windowStart: number,
  windowEnd: number,
  splitPosition: number,
  prefixLength: number,
) {
  const indexes: number[] = []
  for (let pos = windowStart; pos < windowEnd; pos++) {
    if (pos === splitPosition - 1) continue
    if (pos % 3 !== 0) continue
    let index = prefixLength
    for (let cursor = windowStart; cursor <= pos; cursor++) {
      if (cursor === splitPosition) index++
      index++
    }
    indexes.push(index - 1)
  }
  return indexes
}

function getEditedIndexesForHexamer(
  originalHexamer: string,
  nextHexamer: string,
) {
  const editedIndexes: number[] = []
  for (let i = 0; i < originalHexamer.length; i++) {
    if (originalHexamer[i] !== nextHexamer[i]) editedIndexes.push(i)
  }
  return editedIndexes
}

export function getEditedPositions(
  selectedSite: WggwSiteCandidate,
  currentRewrite: WggwRecodingOption,
) {
  const positions = new Set<number>()
  for (const index of getEditedIndexesForHexamer(
    selectedSite.originalHexamer,
    currentRewrite.newHexamer,
  )) {
    positions.add(selectedSite.hexamerStart + index)
  }
  return positions
}

export function roleStylesFor(role: CodonRole): {
  container: string
  aa: string
  base: string
} {
  switch (role) {
    case 'split':
      return {
        container: 'bg-primary/15 ring-primary/40 ring-1',
        aa: 'text-primary font-semibold',
        base: 'text-foreground',
      }
    case 'start':
      return {
        container: 'bg-success/15 ring-success/40 ring-1',
        aa: 'text-success-soft font-semibold',
        base: 'text-success-soft',
      }
    case 'stop':
      return {
        container: 'bg-danger/15 ring-danger/40 ring-1',
        aa: 'text-danger-soft font-semibold',
        base: 'text-danger-soft',
      }
    case 'internal-stop':
      return {
        container: 'bg-danger/20 ring-danger/50 ring-1',
        aa: 'text-danger-soft font-semibold',
        base: 'text-danger-soft',
      }
    default:
      return {
        container: '',
        aa: 'text-muted-foreground/70',
        base: 'text-muted-foreground',
      }
  }
}

export function formatMotifSplit(motif: string) {
  return `${motif.slice(0, 2)}|${motif.slice(2)}`
}
