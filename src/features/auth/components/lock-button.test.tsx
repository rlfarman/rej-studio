import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'

import { SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

import { authCopy } from '../copy'
import { LockButton } from './lock-button'

describe('LockButton', () => {
  it('ends the passcode session with a plain post to /api/logout', () => {
    render(
      <TooltipProvider>
        <SidebarProvider>
          <LockButton />
        </SidebarProvider>
      </TooltipProvider>,
    )
    const button = screen.getByRole('button', { name: authCopy.lock.label })
    const form = button.closest('form')
    expect(form?.getAttribute('action')).toBe('/api/logout')
    expect(form?.getAttribute('method')).toBe('post')
    // A submit button, so the post works with no JavaScript at all.
    expect(button.getAttribute('type')).toBe('submit')
  })
})
