'use server'

import { db } from '@/drizzle/db'
import { transcriptResults } from '@/drizzle/schema'
import { eq, inArray } from 'drizzle-orm'

export async function getTranscriptResult(transcriptId: string) {
  const [result] = await db
    .select()
    .from(transcriptResults)
    .where(eq(transcriptResults.transcriptId, transcriptId))
    .limit(1)

  return result ?? null
}

export async function getAvailableTranscriptResultIds(
  transcriptIds: string[],
) {
  if (transcriptIds.length === 0) return new Set<string>()

  const rows = await db
    .select({ transcriptId: transcriptResults.transcriptId })
    .from(transcriptResults)
    .where(inArray(transcriptResults.transcriptId, transcriptIds))

  return new Set(rows.map((r) => r.transcriptId))
}
