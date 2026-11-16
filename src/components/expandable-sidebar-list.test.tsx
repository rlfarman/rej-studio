import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { ExpandableSidebarList } from './expandable-sidebar-list'

const KEY = 'test-sidebar-open'

function renderList(props: { persistKey?: string; defaultOpen?: boolean }) {
  return render(
    <ExpandableSidebarList
      label="Recent"
      items={['TP53', 'BRCA1']}
      getItemKey={(item) => item}
      renderItem={(item) => <li>{item}</li>}
      emptyMessage="Nothing yet"
      {...props}
    />,
  )
}

// Scope to the view's container: render() queries default to document.body,
// which holds every list rendered in the test.
const toggle = (view: ReturnType<typeof renderList>) =>
  within(view.container).getByRole('button', { name: /Recent/ })

beforeEach(() => localStorage.clear())
afterEach(() => cleanup())

describe('ExpandableSidebarList open state', () => {
  it('uses defaultOpen when nothing is stored', () => {
    const view = renderList({ persistKey: KEY, defaultOpen: false })
    expect(toggle(view).getAttribute('aria-expanded')).toBe('false')
  })

  it('restores the stored state', () => {
    localStorage.setItem(KEY, '0')
    const view = renderList({ persistKey: KEY, defaultOpen: true })
    expect(toggle(view).getAttribute('aria-expanded')).toBe('false')
  })

  it('persists toggles and keeps lists sharing a key in sync', () => {
    const first = renderList({ persistKey: KEY })
    const second = renderList({ persistKey: KEY })
    fireEvent.click(toggle(first))
    expect(localStorage.getItem(KEY)).toBe('0')
    expect(toggle(first).getAttribute('aria-expanded')).toBe('false')
    expect(toggle(second).getAttribute('aria-expanded')).toBe('false')
  })

  it('toggles in memory without a persistKey', () => {
    const view = renderList({})
    fireEvent.click(toggle(view))
    expect(toggle(view).getAttribute('aria-expanded')).toBe('false')
    expect(localStorage.length).toBe(0)
  })
})
