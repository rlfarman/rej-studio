import type { Gene } from '@/types/gene'
import { hasPrecomputedZip } from '@/lib/genes'
import IsoformCard from './isoform-card'

interface IsoformListProperties {
  gene: Gene
}

export default async function IsoformList({ gene }: IsoformListProperties) {
  const precomputedResults = await Promise.allSettled(
    gene.isoforms.map((isoform) =>
      hasPrecomputedZip(gene.symbol, isoform.ENST)
    )
  )
  const precomputedChecks = precomputedResults.map(
    (r) => r.status === 'fulfilled' && r.value
  )

  return (
    <div className="mt-2 flex flex-col gap-4">
      {gene.isoforms.map((isoform, i) => (
        <IsoformCard
          key={isoform.ENST}
          isoform={isoform}
          symbol={gene.symbol}
          hasPrecomputed={precomputedChecks[i]}
        />
      ))}
    </div>
  )
}
