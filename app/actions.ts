'use server'

import { db } from '@/drizzle/db'
import {
  SelectGene,
  favorites,
  genes,
  isoforms,
  jobs,
  searches,
  sessions,
} from '@/drizzle/schema'
import { openai } from '@/lib/openai'
import { desc, sql, cosineDistance, gt, eq, and } from 'drizzle-orm'
import { embed } from 'ai'
import { ENST_REGEX, ENSG_REGEX } from '@/lib/regex'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

type SessionPayload = {
  sessionId: string
  expiresAt: Date
}

const secretKey = process.env.SESSION_SECRET
const encodedKey = new TextEncoder().encode(secretKey)

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey)
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    })
    return payload
  } catch (error) {
    console.log('Failed to verify session')
  }
}

export type GeneSearchResult = Pick<SelectGene, 'id' | 'name' | 'symbol'> & {
  similarity?: number
}

export async function searchGenes(
  query: string
): Promise<Array<GeneSearchResult>> {
  try {
    const trimmedQuery = query.trim()
    if (trimmedQuery.length === 0) return []

    // Check if the query is an ENST or ENSMUST
    if (ENST_REGEX.test(trimmedQuery)) {
      const gene = await searchGeneByENST(trimmedQuery)
      return gene ? [gene] : []
    }

    // Check if the query is an ENSG or ENSMUSG
    if (ENSG_REGEX.test(trimmedQuery)) {
      const gene = await searchGeneByENSG(trimmedQuery)
      return gene ? [gene] : []
    }

    // Default search using cosine distance
    const embedding = await generateEmbedding(trimmedQuery)
    const vectorQuery = `[${embedding.join(',')}]`

    const similarity = sql<number>`1 - (${cosineDistance(
      genes.embedding,
      vectorQuery
    )})`

    const gene = await db
      .select({
        id: genes.id,
        name: genes.name,
        symbol: genes.symbol,
        similarity,
      })
      .from(genes)
      .where(gt(similarity, 0.25))
      .orderBy((t) => desc(t.similarity))
      .limit(6)

    return gene
  } catch (error) {
    console.error(error)
    throw error
  }
}

async function searchGeneByENST(
  enst: string
): Promise<GeneSearchResult | undefined> {
  try {
    const [isoform] = await db
      .select({
        geneId: isoforms.geneId,
      })
      .from(isoforms)
      .where(eq(isoforms.ENST, enst))
      .limit(1)

    if (!isoform) return undefined

    const [gene] = await db
      .select({
        id: genes.id,
        name: genes.name,
        symbol: genes.symbol,
        similarity: sql<number>`1`, // Set similarity to 1 for exact match
      })
      .from(genes)
      .where(eq(genes.id, isoform.geneId))
      .limit(1)

    return gene
  } catch (error) {
    console.error(error)
    throw error
  }
}

async function searchGeneByENSG(
  ensg: string
): Promise<GeneSearchResult | undefined> {
  try {
    const [gene] = await db
      .select({
        id: genes.id,
        name: genes.name,
        symbol: genes.symbol,
        similarity: sql<number>`1`, // Set similarity to 1 for exact match
      })
      .from(genes)
      .where(eq(genes.ENSG, ensg))
      .limit(1)

    return gene
  } catch (error) {
    console.error(error)
    throw error
  }
}

async function generateEmbedding(raw: string) {
  // OpenAI recommends replacing newlines with spaces for best results
  const input = raw.replace(/\n/g, ' ')
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: input,
  })
  return embedding
}

export async function getIsoformsByGene(geneId: string) {
  try {
    const isoformData = await db
      .select({
        id: isoforms.id,
        enst: isoforms.ENST,
        length: isoforms.length,
        species: isoforms.species,
      })
      .from(isoforms)
      .where(eq(isoforms.geneId, geneId))
      // Order by descending enst
      .orderBy(isoforms.ENST)

    return isoformData
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getGeneBySymbol(symbol: string) {
  try {
    const [gene] = await db
      .select({
        id: genes.id,
        name: genes.name,
        symbol: genes.symbol,
        ENSG: genes.ENSG,
        chromosome: genes.chromosome,
      })
      .from(genes)
      .where(eq(genes.symbol, symbol))
      .limit(1)

    if (gene === undefined) {
      return undefined
    }

    return gene
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function createSession(userId?: string) {
  try {
    const sessionId = '1234'
    console.log('Creating session:', sessionId)
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    await db.insert(sessions).values({
      id: sessionId,
      // userId: userId || null,
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
        // userId: sessions.userId,
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

export async function createSearch({
  query,
  geneId,
  userId,
}: {
  query: string
  geneId: string
  userId: string
}) {
  try {
    await db.insert(searches).values({
      query,
      geneId,
      userId,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getRecentSearchedGenes({ userId }: { userId: string }) {
  try {
    return db
      .selectDistinctOn([searches.geneId], {
        id: genes.id,
        searchCreatedAt: searches.createdAt,
        symbol: genes.symbol,
        name: genes.name,
      })
      .from(searches)
      .innerJoin(genes, eq(searches.geneId, genes.id))
      .where(eq(searches.userId, userId))
      .orderBy(searches.geneId, desc(searches.createdAt)) // Match the initial ORDER BY expressions with DISTINCT ON
      .limit(6)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const createJob = async ({
  userId,
  name,
  sequence,
}: {
  userId: string
  name: string
  sequence: string
}) => {
  try {
    await db.insert(jobs).values({
      userId,
      name,
      sequence,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const getRecentJobs = async ({ userId }: { userId: string }) => {
  try {
    return db
      .select({
        id: jobs.id,
        name: jobs.name,
        // only get the first 24 characters of the sequence
        sequence: sql<string>`substr(${jobs.sequence}, 1, 24)`,
        createdAt: jobs.createdAt,
      })
      .from(jobs)
      .where(eq(jobs.userId, userId))
      .orderBy((t) => desc(t.createdAt))
      .limit(6)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const addFavorite = async ({
  geneId,
  userId,
}: {
  geneId: string
  userId: string
}) => {
  try {
    await db.insert(favorites).values({
      userId,
      geneId,
    })
  } catch (error) {
    console.error('Error adding favorite:', error)
    throw error
  }
}

export const removeFavorite = async ({
  geneId,
  userId,
}: {
  geneId: string
  userId: string
}) => {
  try {
    await db
      .delete(favorites)
      .where(and(eq(favorites.geneId, geneId), eq(favorites.userId, userId)))
  } catch (error) {
    console.error('Error removing favorite:', error)
    throw error
  }
}

export const isFavoriteGene = async ({
  geneId,
  userId,
}: {
  geneId: string
  userId: string
}) => {
  try {
    const favorite = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.geneId, geneId), eq(favorites.userId, userId)))
      .limit(1)
    return !!favorite[0]
  } catch (error) {
    console.error('Error checking favorite status:', error)
    throw error
  }
}

export const getFavorites = async ({ userId }: { userId: string }) => {
  try {
    return db
      .select({
        id: genes.id,
        symbol: genes.symbol,
        name: genes.name,
      })
      .from(favorites)
      .innerJoin(genes, eq(favorites.geneId, genes.id))
      .where(eq(favorites.userId, userId))
  } catch (error) {
    console.error('Error fetching favorites:', error)
    throw error
  }
}
