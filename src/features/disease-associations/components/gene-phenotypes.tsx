import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { AssociationRow, PhenotypeStatus } from '../types'
import { diseaseAssociationsCopy } from '../copy'

type Props = {
  row: AssociationRow
  omimMim?: number | null
}

const STATUS_BADGE_CLASS: Record<PhenotypeStatus, string> = {
  confirmed: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  provisional: 'bg-muted text-muted-foreground border-border',
  susceptibility: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  nondisease: 'bg-muted text-muted-foreground border-border',
}

export function GenePhenotypes({ row, omimMim }: Props) {
  const { heading, subtitle, openOmimGene } = diseaseAssociationsCopy.geneDetail
  const { statusLabel, mimLinkAria } = diseaseAssociationsCopy.phenotype

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{heading}</h2>
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        </div>
        {omimMim != null && (
          <a
            href={`https://omim.org/entry/${omimMim}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-mono text-[11px]"
          >
            OMIM {omimMim}
            <ExternalLink className="size-3" aria-hidden />
            <span className="sr-only">{openOmimGene}</span>
          </a>
        )}
      </header>

      <ul className="flex flex-col divide-y rounded-md border">
        {row.phenotypes.map((p, i) => (
          <li
            key={`${p.mim ?? 'nomim'}-${i}`}
            className="flex flex-col gap-1 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm">{p.name}</span>
              <Badge
                variant="outline"
                className={`shrink-0 text-[10px] font-normal ${STATUS_BADGE_CLASS[p.status]}`}
              >
                {statusLabel[p.status]}
              </Badge>
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {p.inheritance && <span>{p.inheritance}</span>}
              {p.mim != null && (
                <>
                  {p.inheritance && <span className="text-border">·</span>}
                  <a
                    href={`https://omim.org/entry/${p.mim}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground inline-flex items-center gap-1 font-mono"
                    aria-label={mimLinkAria(p.mim)}
                  >
                    {p.mim}
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
