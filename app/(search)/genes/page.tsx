import type { Metadata } from 'next'
import GeneSearch from '@/search/components/gene-search'

export const metadata: Metadata = {
  title: 'Gene Search',
  description:
    'Search genes by symbol, name, or isoform to design RNA end-joining sequences.',
}

export default function GeneSearchPage() {
  return <GeneSearch />
}
