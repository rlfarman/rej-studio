import { useQueryClient } from '@tanstack/react-query'
import { LogIn, LogOut, UserRound } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { accountCopy } from '@/copy/account'
import { afterAccountChange, useAccount } from '@/lib/account/account'
import { loadAuthClient } from '@/lib/account/actions'
import { toast } from '@/lib/toast'
import { openSignIn } from '@/stores/sign-in-dialog-store'

/**
 * The account entry in the sidebar footer: "Sign in" when signed out, the
 * account's email (with "Sign out") when signed in, and nothing while the
 * state is unknown or accounts are not available, so the prerendered shell
 * and a deployment without accounts draw no sign-in at all.
 */
export function AccountMenu() {
  const account = useAccount()
  const queryClient = useQueryClient()

  if (account.status === 'loading' || account.status === 'unavailable') {
    return null
  }

  if (account.status === 'signed-out') {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip={accountCopy.signIn} onClick={openSignIn}>
            <LogIn />
            <span>{accountCopy.signIn}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const { email } = account.user

  async function handleSignOut() {
    const { signOut } = await loadAuthClient()
    const result = await signOut()
    if (!result.ok) {
      toast.error(accountCopy.signOutFailed)
      return
    }
    await afterAccountChange(queryClient)
    toast.success(accountCopy.signedOut)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                tooltip={email}
                aria-label={accountCopy.accountMenuAria(email)}
              />
            }
          >
            <UserRound />
            <span className="truncate">{email}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="max-w-64 truncate">
                {accountCopy.signedInAs(email)}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void handleSignOut()}>
              <LogOut className="h-4 w-4 text-foreground" />
              {accountCopy.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
