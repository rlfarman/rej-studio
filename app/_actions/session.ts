'use server'

import { db } from '@/drizzle/db'
import { sessions } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

type SessionPayload = {
  sessionId: string
  expiresAt: Date
}

function getEncodedKey() {
  const secretKey = process.env.SESSION_SECRET
  if (!secretKey) {
    throw new Error(
      'SESSION_SECRET environment variable is not set. Sessions will not work.',
    )
  }
  return new TextEncoder().encode(secretKey)
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getEncodedKey())
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, getEncodedKey(), {
      algorithms: ['HS256'],
    })
    return payload
  } catch (error) {
    console.error('Failed to verify session')
  }
}

export async function createSession(userId?: string) {
  try {
    const sessionId = crypto.randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)
    await db.insert(sessions).values({
      id: sessionId,
      userId: userId || null,
      expiresAt,
    })

    const session = await encrypt({ sessionId, expiresAt })
    const cookieStore = await cookies()
    cookieStore.set('session', session, {
      httpOnly: true,
      secure: true,
      expires: expiresAt,
      sameSite: 'lax',
      path: '/',
    })

    return sessionId
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getSession(sessionId: string) {
  try {
    const [session] = await db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        createdAt: sessions.createdAt,
        updatedAt: sessions.updatedAt,
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1)

    return session
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function deleteSession(sessionId: string) {
  try {
    await db.delete(sessions).where(eq(sessions.id, sessionId))
  } catch (error) {
    console.error(error)
    throw error
  }
}
