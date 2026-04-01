import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ callId: string }> },
) {
  const { callId } = await params
  const modalUrl = process.env.MODAL_API_URL
  if (!modalUrl) {
    return NextResponse.json(
      { error: 'MODAL_API_URL is not configured' },
      { status: 500 },
    )
  }

  const response = await fetch(`${modalUrl}/jobs/${callId}`)

  if (!response.ok) {
    const text = await response.text()
    return NextResponse.json(
      { error: `Modal API error: ${text}` },
      { status: response.status },
    )
  }

  const data = await response.json()
  return NextResponse.json(data)
}
