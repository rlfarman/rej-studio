import { NextRequest, NextResponse } from 'next/server'

export const config = {
  matcher: ['/', '/index'],
}

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const aBuf = encoder.encode(a)
  const bBuf = encoder.encode(b)
  // Use HMAC-based comparison for constant-time equality
  const key = await crypto.subtle.generateKey(
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const aMac = await crypto.subtle.sign('HMAC', key, aBuf)
  const bMac = await crypto.subtle.sign('HMAC', key, bBuf)
  const aArr = new Uint8Array(aMac)
  const bArr = new Uint8Array(bMac)
  let result = aArr.length === bArr.length ? 1 : 0
  for (let i = 0; i < aArr.length; i++) {
    result &= aArr[i] === bArr[i] ? 1 : 0
  }
  return result === 1
}

export async function proxy(req: NextRequest) {
  const basicAuth = req.headers.get('authorization')
  const url = req.nextUrl

  const expectedUser = process.env.BASIC_AUTH_USER
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD

  if (basicAuth && expectedUser && expectedPassword) {
    try {
      const authValue = basicAuth.split(' ')[1]
      const [user, pwd] = atob(authValue).split(':')

      const userMatch = await timingSafeEqual(user, expectedUser)
      const pwdMatch = await timingSafeEqual(pwd, expectedPassword)

      if (userMatch && pwdMatch) {
        return NextResponse.next()
      }
    } catch {
      // Malformed Base64 in Authorization header
    }
  }
  url.pathname = '/api/auth'

  return NextResponse.rewrite(url)
}
