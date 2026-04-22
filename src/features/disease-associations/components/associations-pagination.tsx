import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { diseaseAssociationsCopy } from '../copy'

type Props = {
  currentPage: number
  totalPages: number
  pageStart: number
  pageEnd: number
  total: number
  searchParams: Record<string, string | string[] | undefined>
}

function buildHref(
  searchParams: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'page' || value == null) continue
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v)
    } else {
      params.set(key, value)
    }
  }
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return qs ? `?${qs}` : '?'
}

/**
 * Build a compact page list: first, last, current ± 1, with ellipses for gaps.
 * e.g. 1 … 4 5 [6] 7 8 … 12
 */
function buildPageList(
  current: number,
  total: number,
): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set<number>([1, total, current - 1, current, current + 1])
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b)
  const result: (number | 'ellipsis')[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('ellipsis')
    result.push(sorted[i])
  }
  return result
}

export function AssociationsPagination({
  currentPage,
  totalPages,
  pageStart,
  pageEnd,
  total,
  searchParams,
}: Props) {
  const { pageSummary, paginationAria } = diseaseAssociationsCopy.table
  const pages = buildPageList(currentPage, totalPages)
  const hasPrev = currentPage > 1
  const hasNext = currentPage < totalPages

  return (
    <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
      <div className="text-muted-foreground text-xs" aria-live="polite">
        {pageSummary(pageStart, pageEnd, total)}
      </div>
      {totalPages > 1 && (
        <Pagination aria-label={paginationAria} className="sm:mx-0 sm:w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={
                  hasPrev ? buildHref(searchParams, currentPage - 1) : undefined
                }
                aria-disabled={!hasPrev}
                tabIndex={hasPrev ? undefined : -1}
                className={
                  hasPrev ? undefined : 'pointer-events-none opacity-50'
                }
              />
            </PaginationItem>
            {pages.map((p, idx) =>
              p === 'ellipsis' ? (
                <PaginationItem key={`e-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    href={buildHref(searchParams, p)}
                    isActive={p === currentPage}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                href={
                  hasNext ? buildHref(searchParams, currentPage + 1) : undefined
                }
                aria-disabled={!hasNext}
                tabIndex={hasNext ? undefined : -1}
                className={
                  hasNext ? undefined : 'pointer-events-none opacity-50'
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
