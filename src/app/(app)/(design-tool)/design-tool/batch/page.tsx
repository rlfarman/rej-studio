import { BatchForm } from '@/features/design-tool/components/batch-form'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Batch Optimization',
  description:
    'Optimize multiple coding sequences at once. Upload a FASTA or CSV file to batch-process sequences for RNA End-Joining.',
  alternates: { canonical: '/design-tool/batch' },
}

export default function BatchPage() {
  return <BatchForm />
}
