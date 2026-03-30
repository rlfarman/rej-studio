'use server'

import { db } from '@/drizzle/db'
import { jobs } from '@/drizzle/schema'
import { desc, sql, eq } from 'drizzle-orm'

interface JobOptions {
  codon_optimize: string | null
  codon_optimize_weight: number
  remove_cryptic_ss: boolean
  remove_cryptic_ss_weight: number
  minimize_CpGs: boolean
  minimize_CpGs_weight: number
  reduce_kmer_complexity: boolean
  reduce_kmer_complexity_weight: number
  enforce_gc: boolean
  stim_5: boolean
  stim_3: boolean
  split_point: number
  ensure_wggw: boolean
  wggw_threshold: number
}

export const createJob = async ({
  userId,
  name,
  sequence,
  options,
}: {
  userId: string
  name: string
  sequence: string
  options?: JobOptions
}) => {
  try {
    await db.insert(jobs).values({
      userId,
      name,
      sequence,
      options: JSON.stringify(options),
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
