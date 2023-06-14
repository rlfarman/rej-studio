type ENSG = `ENSG${number}`

interface Gene {
  symbol: string
  name: string
  ENSG: ENSG
  chromosome: string
  isoforms: Isoform[]
  diseaseAssociations: string[]
}
