import { describe, expect, it } from 'vitest'
import { geneVector, lexemes, tsRank } from './text-search'

// Every expectation here is what Postgres 17 (PGlite) returned for the same
// input, so a failure means the port drifted from the database, not that
// the database is wrong.

describe('lexemes (to_tsvector simple)', () => {
  it.each([
    ['Tumor protein p53', ['tumor', 'protein', 'p53']],
    // Hyphenated compounds: the whole, then each part.
    ['HLA-A', ['hla-a', 'hla', 'a']],
    ['H2-K1', ['h2-k1', 'h2', 'k1']],
    ['Rab-1A', ['rab-1a', 'rab', '1a']],
    // A number after a hyphen is signed, unless a compound took the hyphen.
    ['foo-1', ['foo', '-1']],
    ['HEL-S-18', ['hel-s', 'hel', 's', '18']],
    ['IGHV4-38-2', ['ighv4', '-38', '-2']],
    ['5-HT-4', ['5', 'ht', '-4']],
    ['SR+89', ['sr', '+89']],
    ["2'-5'-oligoadenylate", ['2', '-5', 'oligoadenylate']],
    // Dotted hosts and versions, slash paths.
    ['DJ20N2.5', ['dj20n2.5']],
    ['214K23.2', ['214k23.2']],
    ['joining 2.1', ['joining', '2.1']],
    ['1.a', ['1', 'a']],
    ['CFTR/MRP', ['cftr/mrp']],
    ['Na+/k+', ['na', '/k']],
    // Scientific notation ends a word.
    ['1110036E10RIK', ['1110036e10', 'rik']],
    ['363E6.2', ['363e6', '2']],
    ['4432404P07RIK', ['4432404p07rik']],
    // XML-like tags are skipped; `<0>` isn't a tag.
    ['P56<LCK> x', ['p56', 'x']],
    ['B<0>AT1', ['b', '0', 'at1']],
    [
      'TG(TETO-MAPT*P301L)4510KHA',
      ['tg', 'teto-mapt', 'teto', 'mapt', 'p301l', '4510kha'],
    ],
    ['MGC:15815', ['mgc', '15815']],
    ['F23149_1', ['f23149', '1']],
  ])('%s', (text, expected) => {
    expect(lexemes(text)).toEqual(expected)
  })
})

describe('geneVector', () => {
  it('weights symbol A, name B, aliases C, with || position offsets', () => {
    const vector = geneVector('BRCA1', 'BRCA1 DNA repair', '|BRCC1|')
    const show = (packed: number[]) =>
      packed.map((p) => `${p >> 2}${'DCBA'[p & 3]}`)
    expect(show(vector.get('brca1')!)).toEqual(['1A', '2B'])
    expect(show(vector.get('repair')!)).toEqual(['4B'])
    expect(show(vector.get('brcc1')!)).toEqual(['5C'])
  })

  it('skips the offset of an empty field', () => {
    const vector = geneVector('', 'Name', '|X|')
    expect(vector.get('name')).toEqual([1 * 4 + 2])
    expect(vector.get('x')).toEqual([2 * 4 + 1])
  })
})

describe('tsRank', () => {
  const brca1 = geneVector(
    'BRCA1',
    'BRCA1 DNA repair associated',
    '|BRCAI|BRCC1|',
  )
  it.each([
    [
      geneVector('TP53', 'Tumor protein p53', '|BCC7|BMFS5|LFS1|P53|TRP53|'),
      'p53',
      0.27356719970703125,
    ],
    [brca1, 'brca1', 0.6687197685241699],
    [brca1, 'dna repair', 0.3964128792285919],
    [brca1, 'brca1 associated', 0.7572203278541565],
    [brca1, 'kinase', 0],
    [brca1, 'repair kinase', 9.999999682655225e-21],
    [
      geneVector(
        'HLA-A',
        'Major histocompatibility complex, class I, A',
        '|HLAA|',
      ),
      'hla-a',
      0.9999996423721313,
    ],
  ])('matches ts_rank for %#: %s', (vector, query, expected) => {
    expect(tsRank(lexemes(query), vector)).toBe(expected)
  })
})
