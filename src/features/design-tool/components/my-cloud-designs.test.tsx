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
import { formatTimeAgo } from '../utils/time-ago'
import { designToolCopy } from '../copy'
import { MyCloudDesigns } from './my-cloud-designs'

const copy = designToolCopy.cloud.myDesigns
const HERE = 'a'.repeat(64)
const ELSEWHERE = 'b'.repeat(64)

const RUNNING = 'c'.repeat(64)
const FAILED = 'd'.repeat(64)
const OLD = 'e'.repeat(64)

const DESIGNS: CloudDesignSummary[] = [
  {
    id: ELSEWHERE,
    name: 'From the lab PC',
    bases: 1200,
    submittedAt: '2026-11-02T00:00:00Z',
    status: 'completed',
  },
  {
    id: RUNNING,
    name: 'Still going',
    bases: 30000,
    submittedAt: '2026-11-02T00:00:00Z',
    status: 'running',
  },
  {
    id: FAILED,
    name: 'Went wrong',
    bases: 1200,
    submittedAt: '2026-11-02T00:00:00Z',
    status: 'failed',
  },
  {
    // A row written before the status column: nothing knows its state.
    id: OLD,
    name: 'From before',
    bases: 1200,
    submittedAt: '2026-11-02T00:00:00Z',
    status: null,
  },
  {
    id: HERE,
    name: 'Already here',
    bases: 900,
    submittedAt: '2026-11-01T00:00:00Z',
    status: 'completed',
  },
]

const AGE = formatTimeAgo('2026-11-02T00:00:00Z')

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
    // Dated: from another device the list said only a name and a length.
    expect(
      screen.getByText(copy.subline(copy.state.completed, 1200, AGE, 30)),
    ).toBeTruthy()
    expect(screen.queryByText('Already here')).toBeNull()
    fireEvent.click(screen.getByText('From the lab PC'))
    expect(onSelect).toHaveBeenCalledWith(ELSEWHERE)
  })

  it('says where each design got to, and how long one with an outcome is kept', async () => {
    // The list shows three at a time; this browser already has the first.
    useJobHistory.getState().upsertEntry({
      id: ELSEWHERE,
      status: 'completed',
      cloudId: ELSEWHERE,
    })
    renderList('signed-in')
    // Running and queued designs have no outcome to count retention from,
    // and a row from before the status column knows nothing to count.
    expect(
      await screen.findByText(
        copy.subline(copy.state.running, 30000, AGE, null),
      ),
    ).toBeTruthy()
    expect(
      screen.getByText(copy.subline(copy.state.failed, 1200, AGE, 7)),
    ).toBeTruthy()
    expect(
      screen.getByText(copy.subline(copy.state.unknown, 1200, AGE, null)),
    ).toBeTruthy()
  })

  it('draws nothing when every design is already in this browser', () => {
    for (const id of [HERE, ELSEWHERE, RUNNING, FAILED, OLD]) {
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
