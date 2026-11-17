import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { useLinkProps } from '@tanstack/react-router'
import { diseaseAssociationsCopy } from '../copy'

type Props = {
  currentPage: number
  totalPages: number
  pageStart: number
  pageEnd: number
  total: number
}

/**
 * Props for a link to `page` of the explorer, keeping its filters and sort.
 * The first page has no param, so the plain URL stays the canonical one.
 */
function usePageLinkProps(page: number) {
  return useLinkProps({
    from: '/disease-associations',
    to: '.',
    search: (prev) => ({ ...prev, page: page > 1 ? page : undefined }),
  })
}

function PageLink({ page, isActive }: { page: number; isActive: boolean }) {
  return (
    <PaginationLink {...usePageLinkProps(page)} isActive={isActive}>
      {page}
    </PaginationLink>
  )
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
}: Props) {
  const { pageSummary, paginationAria } = diseaseAssociationsCopy.table
  const pages = buildPageList(currentPage, totalPages)
  const hasPrev = currentPage > 1
  const hasNext = currentPage < totalPages
  // Hooks run on every render; the links themselves only render with a
  // page to go to.
  const prevLink = usePageLinkProps(currentPage - 1)
  const nextLink = usePageLinkProps(currentPage + 1)

  return (
    <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
      <div className="text-xs text-muted-foreground" aria-live="polite">
        {pageSummary(pageStart, pageEnd, total)}
      </div>
      {totalPages > 1 && (
        <Pagination aria-label={paginationAria} className="sm:mx-0 sm:w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                {...(hasPrev ? prevLink : undefined)}
                // Without an href this <a> is a generic element, where aria-label
                // is prohibited; role="link" + aria-disabled is the disabled-link
                // pattern.
                role={hasPrev ? undefined : 'link'}
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
                  <PageLink page={p} isActive={p === currentPage} />
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                {...(hasNext ? nextLink : undefined)}
                // Without an href this <a> is a generic element, where aria-label
                // is prohibited; role="link" + aria-disabled is the disabled-link
                // pattern.
                role={hasNext ? undefined : 'link'}
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
