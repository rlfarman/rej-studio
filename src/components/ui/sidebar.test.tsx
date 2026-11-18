import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { TooltipProvider } from '@/components/ui/tooltip'

import {
  Sidebar,
  SidebarProvider,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from './sidebar'

/** The sidebar reads the viewport through useIsMobile (window.innerWidth). */
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

function renderSidebar() {
  return render(
    <TooltipProvider>
      <SidebarProvider>
        <SidebarTrigger aria-label="toggle" />
        <Sidebar
          collapsible="icon"
          containerProps={{ role: 'navigation', 'aria-label': 'Main' }}
          sheetTitle="Main navigation"
          sheetDescription="Pages and history."
        >
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>Home</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </Sidebar>
      </SidebarProvider>
    </TooltipProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Sidebar', () => {
  it('puts its content in the landmark the app asks for (desktop)', () => {
    mockViewport(1280)
    renderSidebar()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(nav.contains(screen.getByRole('button', { name: 'Home' }))).toBe(
      true,
    )
  })

  it('names the mobile sheet, and keeps the landmark inside it', () => {
    mockViewport(390)
    renderSidebar()
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }))
    const dialog = screen.getByRole('dialog', { name: 'Main navigation' })
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(dialog.contains(nav)).toBe(true)
  })
})

describe('SidebarTrigger', () => {
  it('reports the desktop panel state', () => {
    mockViewport(1280)
    renderSidebar()
    const trigger = screen.getByRole('button', { name: 'toggle' })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('reports the mobile sheet state, which starts shut', () => {
    mockViewport(390)
    renderSidebar()
    const trigger = screen.getByRole('button', { name: 'toggle' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })
})
