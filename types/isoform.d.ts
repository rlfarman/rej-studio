type Species = 'Human' | 'Mouse'

type ENST = `ENST${number}`

type SearchName = `${string} [${ENST}]`

interface Isoform {
  ENST: ENST
  length: number
  packagability: number
  species: Species
}
