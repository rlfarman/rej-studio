import { fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { Sidebar, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { commonCopy } from '@/copy/common'

import { SidebarToggle } from './sidebar-toggle'

function mockViewport(width: number) {
  vi.stubGlobal('innerWidth', width)
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  )
}

function renderToggle() {
  const { container } = render(
    <TooltipProvider>
      <SidebarProvider>
        <SidebarToggle />
        <Sidebar collapsible="icon">nav</Sidebar>
      </SidebarProvider>
    </TooltipProvider>,
  )
  // By slot, not by role: once the phone sheet is open it has buttons of
  // its own.
  return () =>
    container.querySelector('[data-sidebar="trigger"]') as HTMLElement
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SidebarToggle', () => {
  it('offers to close the open desktop panel, then to open it', () => {
    mockViewport(1280)
    const trigger = renderToggle()
    expect(trigger().getAttribute('aria-label')).toBe(commonCopy.sidebar.close)
    fireEvent.click(trigger())
    expect(trigger().getAttribute('aria-label')).toBe(commonCopy.sidebar.open)
  })

  it('offers to open the phone sheet while it is shut', () => {
    mockViewport(390)
    const trigger = renderToggle()
    // The desktop panel is open at this point: the label must come from the
    // sheet's own state, or it reads "Close sidebar" over a shut sheet.
    expect(trigger().getAttribute('aria-label')).toBe(commonCopy.sidebar.open)
    fireEvent.click(trigger())
    expect(trigger().getAttribute('aria-label')).toBe(commonCopy.sidebar.close)
  })

  it('leaves Ctrl+B to a field being typed in', () => {
    mockViewport(1280)
    const trigger = renderToggle()
    const field = document.createElement('textarea')
    document.body.appendChild(field)
    fireEvent.keyDown(field, { key: 'b', ctrlKey: true })
    expect(trigger().getAttribute('aria-label')).toBe(commonCopy.sidebar.close)
    // Anywhere else it still folds the sidebar.
    fireEvent.keyDown(document.body, { key: 'b', ctrlKey: true })
    expect(trigger().getAttribute('aria-label')).toBe(commonCopy.sidebar.open)
    field.remove()
  })
})
