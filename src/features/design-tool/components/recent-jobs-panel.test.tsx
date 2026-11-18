// The X on a running entry in Recent jobs. Writing a cancelled history entry
// is not cancelling: only aborting the run stops the worker, and without that
// the result arrives seconds later and replaces what the person just stopped.

import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { SidebarProvider } from '@/components/ui/sidebar'
import {
  BROWSER_ID_PREFIX,
  useJobHistory,
  whenJobHistoryHydrated,
} from '@/features/design-tool/hooks/use-job-history'
import { registerBrowserRun } from '@/features/design-tool/api/browser-optimizer'
import type { FormValues } from '@/features/design-tool/types/form-schema'

import { RecentJobs } from './recent-jobs-panel'

const RUNNING_ID = `${BROWSER_ID_PREFIX}running-one`

beforeEach(async () => {
  await whenJobHistoryHydrated()
  useJobHistory.setState({ entries: [], progressById: {} })
  localStorage.clear()
})

afterEach(() => cleanup())

function showPanel() {
  return render(
    <SidebarProvider>
      <RecentJobs />
    </SidebarProvider>,
  )
}

/** Only the fields the panel and the store's naming read. */
const named = (name: string) =>
  ({ name, codingSequence: 'ATGAAATGA' }) as unknown as FormValues

/** A running entry as the submit path writes one, with its live controller. */
function startRun(id = RUNNING_ID, name = 'BRCA2 run') {
  useJobHistory
    .getState()
    .upsertEntry({ id, status: 'running', formValues: named(name) })
  const controller = new AbortController()
  const release = registerBrowserRun(id, controller)
  return { controller, release }
}

describe('cancelling a run from Recent jobs', () => {
  it('aborts the run, not just its history entry', () => {
    const { controller, release } = startRun()
    showPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel BRCA2 run' }))

    expect(controller.signal.aborted).toBe(true)
    expect(useJobHistory.getState().getEntry(RUNNING_ID)?.status).toBe(
      'cancelled',
    )
    release()
  })

  it('leaves other runs alone', () => {
    const mine = startRun()
    const other = startRun(`${BROWSER_ID_PREFIX}other`, 'TP53 run')
    showPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel BRCA2 run' }))

    expect(mine.controller.signal.aborted).toBe(true)
    expect(other.controller.signal.aborted).toBe(false)
    mine.release()
    other.release()
  })

  it('removes a settled entry without touching any run', () => {
    useJobHistory.getState().upsertEntry({
      id: 'done-one',
      status: 'completed',
      formValues: named('Done run'),
    })
    showPanel()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Remove Done run from recent jobs',
      }),
    )

    expect(useJobHistory.getState().getEntry('done-one')).toBeNull()
  })
})
