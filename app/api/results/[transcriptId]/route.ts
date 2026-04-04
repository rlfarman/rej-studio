import { NextResponse } from 'next/server'
import { db } from '@/drizzle/db'
import { transcriptResults } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { zipSync, strToU8 } from 'fflate'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ transcriptId: string }> },
) {
  const { transcriptId } = await params

  const [result] = await db
    .select()
    .from(transcriptResults)
    .where(eq(transcriptResults.transcriptId, transcriptId))
    .limit(1)

  if (!result) {
    return NextResponse.json(
      { error: 'No precomputed results found' },
      { status: 404 },
    )
  }

  const zipped = zipSync({
    [result.optimizationReportFilename]: strToU8(
      result.optimizationReportText,
    ),
    [result.rejFilename]: strToU8(result.rejText),
  })

  return new NextResponse(zipped.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="REJ.${transcriptId}.zip"`,
    },
  })
}
