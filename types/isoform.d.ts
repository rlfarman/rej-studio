enum Species {
  Human,
  Mouse,
}

type HumanENST = `ENST${number}`
type MouseENST = `ENSMUST${number}`

type SearchName = `${string} [${ENST}]`

interface Isoform {
  ENST: HumanENST | MouseENST
  length: number
  packagability: number
  species: Species[Human] | Species[Mouse]
  codingSequence?: string
  proteinSequence?: string
}
