// A server module like src/drizzle/db.ts: marked server-only, so a Client
// Component import fails the Next build.
import 'server-only'

export const runsOn = 'server'
