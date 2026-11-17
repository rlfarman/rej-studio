import { test as setup } from '@playwright/test'

import { STORAGE_STATE } from './constants'
import { signIn } from './sign-in'

// Sign in once and save the session cookie for the signed-in specs.
setup('sign in with the passcode', async ({ page }) => {
  await signIn(page)
  await page.context().storageState({ path: STORAGE_STATE })
})
