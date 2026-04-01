import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const modalUrl = process.env.MODAL_API_URL
  if (!modalUrl) {
    return NextResponse.json(
      { error: 'MODAL_API_URL is not configured' },
      { status: 500 },
    )
  }

  const body = await request.json()

  const response = await fetch(`${modalUrl}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

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
