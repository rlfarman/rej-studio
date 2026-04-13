import { createOpenStatusClient } from '@openstatus/sdk-node'

let cached: ReturnType<typeof createOpenStatusClient> | null = null

export function getOpenStatusClient() {
  const apiKey = process.env.OPENSTATUS_API_KEY
  if (!apiKey) return null
  if (!cached) cached = createOpenStatusClient({ apiKey })
  return cached
}
