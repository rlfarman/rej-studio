import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

vi.mock('../api/cloud-designs', () => ({
  myCloudDesignsQuery: {
    queryKey: ['account', 'cloud-designs'],
    queryFn: () => new Promise(() => {}),
  },
}))

import { renderWithAccount } from '@/components/account/test-utils'
import { useJobHistory, whenJobHistoryHydrated } from '../hooks/use-job-history'
import type { CloudDesignSummary } from '../types/cloud-design'
import { designToolCopy } from '../copy'
import { MyCloudDesigns } from './my-cloud-designs'

const copy = designToolCopy.cloud.myDesigns
const HERE = 'a'.repeat(64)
const ELSEWHERE = 'b'.repeat(64)

const DESIGNS: CloudDesignSummary[] = [
  {
    id: ELSEWHERE,
    name: 'From the lab PC',
    bases: 1200,
    submittedAt: '2026-11-02T00:00:00Z',
  },
  {
    id: HERE,
    name: 'Already here',
    bases: 900,
    submittedAt: '2026-11-01T00:00:00Z',
  },
]

beforeEach(async () => {
  await whenJobHistoryHydrated()
  useJobHistory.setState({ entries: [], progressById: {} })
})

function renderList(fixture: 'signed-in' | 'signed-out', onSelect = vi.fn()) {
  const view = renderWithAccount(
    <MyCloudDesigns onSelect={onSelect} />,
    fixture,
  )
  view.client.setQueryData(['account', 'cloud-designs'], DESIGNS)
  return view
}

describe('MyCloudDesigns', () => {
  it('lists the account’s designs that this browser does not have, and opens one', async () => {
    useJobHistory.getState().upsertEntry({
      id: HERE,
      status: 'completed',
      cloudId: HERE,
    })
    const onSelect = vi.fn()
    renderList('signed-in', onSelect)
    expect(await screen.findByText(copy.label)).toBeTruthy()
    expect(screen.getByText('From the lab PC')).toBeTruthy()
    expect(screen.getByText(copy.subline(1200))).toBeTruthy()
    expect(screen.queryByText('Already here')).toBeNull()
    fireEvent.click(screen.getByText('From the lab PC'))
    expect(onSelect).toHaveBeenCalledWith(ELSEWHERE)
  })

  it('draws nothing when every design is already in this browser', () => {
    for (const id of [HERE, ELSEWHERE]) {
      useJobHistory
        .getState()
        .upsertEntry({ id, status: 'completed', cloudId: id })
    }
    renderList('signed-in')
    expect(screen.queryByText(copy.label)).toBeNull()
  })

  it('draws nothing signed out', () => {
    renderList('signed-out')
    expect(screen.queryByText(copy.label)).toBeNull()
  })
})
