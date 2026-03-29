import { NextRequest, NextResponse } from 'next/server'
import { searchGenes } from '@/lib/genes'
import { rateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'anonymous'
  const { ok, remaining } = rateLimit(ip)

  if (!ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': '60', 'X-RateLimit-Remaining': '0' },
      }
    )
  }

  const query = request.nextUrl.searchParams.get('q') ?? ''
  return NextResponse.json(searchGenes(query), {
    headers: { 'X-RateLimit-Remaining': String(remaining) },
  })
}
