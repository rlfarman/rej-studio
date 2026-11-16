// Shared by playwright.config.ts and the specs. The dev server Playwright
// starts uses these to turn the password gate on, so the suite runs against
// the same configuration production uses.
export const E2E_PORT = 3000
export const E2E_PASSWORD = 'e2e-password'
export const E2E_SESSION_SECRET = 'e2e-session-secret-at-least-32-characters'

// Where the signed-in session from auth.setup.ts is saved (gitignored).
export const STORAGE_STATE = 'e2e/.auth/session.json'
