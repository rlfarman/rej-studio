/**
 * Common Type II restriction enzymes used in molecular cloning.
 * Palindromic recognition sites only — scanning the top strand is sufficient.
 */
interface Enzyme {
  name: string
  site: string
}

const COMMON_ENZYMES: Enzyme[] = [
  { name: 'EcoRI', site: 'GAATTC' },
  { name: 'BamHI', site: 'GGATCC' },
  { name: 'HindIII', site: 'AAGCTT' },
  { name: 'NotI', site: 'GCGGCCGC' },
  { name: 'XbaI', site: 'TCTAGA' },
  { name: 'XhoI', site: 'CTCGAG' },
  { name: 'SalI', site: 'GTCGAC' },
  { name: 'KpnI', site: 'GGTACC' },
  { name: 'NcoI', site: 'CCATGG' },
  { name: 'NheI', site: 'GCTAGC' },
  { name: 'PstI', site: 'CTGCAG' },
  { name: 'SacI', site: 'GAGCTC' },
  { name: 'SpeI', site: 'ACTAGT' },
  { name: 'BglII', site: 'AGATCT' },
  { name: 'MluI', site: 'ACGCGT' },
  { name: 'ApaI', site: 'GGGCCC' },
]

export interface RestrictionHit {
  enzyme: string
  site: string
  position: number // 1-based start
}

/** Find all non-overlapping occurrences of each enzyme site in `seq`. */
export function findRestrictionSites(
  seq: string,
  enzymes: Enzyme[] = COMMON_ENZYMES,
): RestrictionHit[] {
  const upper = seq.toUpperCase()
  const hits: RestrictionHit[] = []
  for (const enzyme of enzymes) {
    let idx = 0
    while ((idx = upper.indexOf(enzyme.site, idx)) !== -1) {
      hits.push({ enzyme: enzyme.name, site: enzyme.site, position: idx + 1 })
      idx += enzyme.site.length
    }
  }
  return hits
}
