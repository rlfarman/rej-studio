// Shared by playwright.config.ts and the specs. The server Playwright starts
// uses these to turn the passcode gate on, so the suite runs against the
// configuration production uses.
export const E2E_PORT = 3000
export const E2E_PASSWORD = 'e2e-passcode'
export const E2E_SESSION_SECRET = 'e2e-session-secret-at-least-32-characters'

// Where the signed-in session from auth.setup.ts is saved (gitignored).
export const STORAGE_STATE = 'e2e/.auth/session.json'
