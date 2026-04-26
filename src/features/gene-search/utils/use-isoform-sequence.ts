'use client'

import { useEffect, useState } from 'react'

// Module-level caches survive across component mounts/unmounts so a sequence
// fetched once stays warm for the rest of the session. Sequences are immutable
// per deploy and Cache-Control is set to immutable on /data/* — there's no
// staleness concern.
const indexPromiseRef: { current: Promise<IsoformIndex> | null } = {
  current: null,
}
const seqBucketCache = new Map<string, Promise<Record<string, string>>>()

type IsoformIndex = Record<
  string,
  { symbol: string; species: string; bucket: string }
>

function loadIndex(): Promise<IsoformIndex> {
  if (!indexPromiseRef.current) {
    indexPromiseRef.current = fetch('/data/isoform-index.json').then((r) => {
      if (!r.ok) throw new Error(`isoform-index ${r.status}`)
      return r.json()
    })
  }
  return indexPromiseRef.current
}

function loadSeqBucket(bucket: string): Promise<Record<string, string>> {
  let cached = seqBucketCache.get(bucket)
  if (cached) return cached
  cached = fetch(`/data/sequences/${bucket}.json`).then((r) => {
    if (!r.ok) throw new Error(`sequences/${bucket} ${r.status}`)
    return r.json()
  })
  seqBucketCache.set(bucket, cached)
  return cached
}

/** Fetch a coding sequence on demand. Returns null while loading. */
export function useIsoformSequence(isoformId: string | null | undefined): {
  sequence: string | null
  loading: boolean
  error: string | null
} {
  const [sequence, setSequence] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isoformId) {
      setSequence(null)
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const idx = await loadIndex()
        const ref = idx[isoformId]
        if (!ref) throw new Error('isoform not in index')
        const seqs = await loadSeqBucket(ref.bucket)
        const seq = seqs[isoformId]
        if (!seq) throw new Error('isoform missing from sequence bucket')
        if (!cancelled) {
          setSequence(seq)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setLoading(false)
        }
        console.error('[useIsoformSequence]', e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isoformId])

  return { sequence, loading, error }
}

/** Imperative form for click handlers — returns a promise. */
export async function fetchIsoformSequence(isoformId: string): Promise<string> {
  const idx = await loadIndex()
  const ref = idx[isoformId]
  if (!ref) throw new Error(`isoform ${isoformId} not in index`)
  const seqs = await loadSeqBucket(ref.bucket)
  const seq = seqs[isoformId]
  if (!seq) throw new Error(`isoform ${isoformId} missing from sequence bucket`)
  return seq
}

/** Bulk fetch — used by the comparison sheet (1+ isoforms at once). */
export async function fetchIsoformSequences(
  isoformIds: string[],
): Promise<Record<string, string>> {
  const idx = await loadIndex()
  const buckets = new Set<string>()
  for (const id of isoformIds) {
    const ref = idx[id]
    if (ref) buckets.add(ref.bucket)
  }
  const bucketResults = await Promise.all(
    [...buckets].map((b) => loadSeqBucket(b)),
  )
  const merged: Record<string, string> = {}
  for (const r of bucketResults) Object.assign(merged, r)
  const out: Record<string, string> = {}
  for (const id of isoformIds) {
    if (merged[id]) out[id] = merged[id]
  }
  return out
}
