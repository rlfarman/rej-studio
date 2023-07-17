import IsoformCard from './isoform-card'

interface IsoformListProperties {
  gene: Gene
}

export default function IsoformList({ gene }: IsoformListProperties) {
  return (
    <div className="flex flex-col gap-4 pt-6">
      {gene.isoforms.map((isoform) => (
        <IsoformCard
          key={isoform.ENST}
          isoform={isoform}
          symbol={gene.symbol}
        />
      ))}
    </div>
  )
}
