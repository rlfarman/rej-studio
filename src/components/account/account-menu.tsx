import { useQueryClient } from '@tanstack/react-query'
import { Lock, LogIn, LogOut, UserRound } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { accountCopy } from '@/copy/account'
import { afterAccountChange, useAccount } from '@/lib/account/account'
import { loadAuthClient } from '@/lib/account/actions'
import { toast } from '@/lib/toast'
import { openSignIn } from '@/stores/sign-in-dialog-store'

/**
 * The account entry in the sidebar footer: an offer of cloud designs when
 * signed out (the lab passcode is a separate thing, so this one says what an
 * account adds rather than "Sign in" a second time), the
 * account's email (with "Sign out") when signed in, and a way back in when
 * the lab passcode session has run out.
 *
 * While the state is unknown it holds the row's height instead of drawing
 * nothing, so the footer below it does not jump once the read lands; a
 * deployment without accounts draws nothing at all, since that row is never
 * going to fill.
 */
export function AccountMenu() {
  const account = useAccount()
  const queryClient = useQueryClient()
  const { setOpenMobile } = useSidebar()

  if (account.status === 'unavailable') return null

  // Also what the prerendered sidebar holds (`useAccount` is `loading`
  // until the page has hydrated), so it stays plain static markup: the
  // hydrating render has to reproduce it exactly.
  if (account.status === 'loading') {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <Skeleton className="h-8 w-full rounded-xl" />
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  // The passcode session ran out: say that, rather than letting the rest of
  // the app read as though accounts did not exist here.
  if (account.status === 'locked') {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            data-account-menu=""
            tooltip={accountCopy.locked.hint}
            aria-label={accountCopy.locked.sidebarAria}
            onClick={() => window.location.reload()}
          >
            <Lock />
            <span>{accountCopy.locked.sidebar}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (account.status === 'signed-out') {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            // Where the sign-in dialog returns focus when whatever opened
            // it is gone (src/stores/sign-in-dialog-store.ts).
            data-account-menu=""
            tooltip={accountCopy.sidebarSignIn}
            onClick={() => {
              // On a phone the sidebar is a sheet over the page: leave it
              // open and the dialog comes up on top of it.
              setOpenMobile(false)
              openSignIn()
            }}
          >
            <LogIn />
            <span>{accountCopy.sidebarSignIn}</span>
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
                data-account-menu=""
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
              {/* Wraps rather than truncates: the trigger above already
                  cuts the address short, and this is where it is read. */}
              <DropdownMenuLabel className="max-w-64 wrap-anywhere">
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
