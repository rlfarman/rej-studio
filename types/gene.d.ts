interface Gene {
  id: number
  symbol: string
  name: string
  ensg: `ENSG${number}`
  enst: `ENST${number}`
  chromosome: number
  length: number
  log10Length: number
  isDiseaseAssociated: boolean
  isOversized: boolean
  searchName: string
  species: 'Human' | 'Mouse'
  pathCDS: `data/coding_sequences/ENST${number}_CDS.fasta`
  pathREJN: `data/coding_sequences/ENST${number}_REJ.N.fasta`
  pathREJC: `data/coding_sequences/ENST${number}_REJ.C.fasta`
}
