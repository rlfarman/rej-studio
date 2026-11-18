import { Lock } from 'lucide-react'

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

import { authCopy } from '../copy'

/**
 * Ends the lab passcode session, the one way out of the gate: a 30-day
 * cookie otherwise keeps a shared lab computer signed in until someone
 * clears it by hand. A plain form post to `/api/logout`
 * (src/server/auth/login.ts), which clears the passcode cookie and the
 * account's with it and sends the browser back to /login — so it works
 * whatever state the app's JavaScript is in.
 */
export function LockButton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <form action="/api/logout" method="post">
          <SidebarMenuButton type="submit" tooltip={authCopy.lock.label}>
            <Lock />
            <span>{authCopy.lock.label}</span>
          </SidebarMenuButton>
        </form>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
