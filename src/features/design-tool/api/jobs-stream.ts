'use client'

// Client-side SSE consumer for /api/py/process-stream (local FastAPI only).
// In production the Python backend runs on Modal and this endpoint 404s —
// callers fall back to the existing server action (submitJob).

import type { ProcessResult } from '@/features/design-tool/types/process-result'

export type StreamEvent =
  | { type: 'init'; name: string; length: number }
  | { type: 'progress'; frac: number; stage: string }
  | { type: 'done'; result: ProcessResult }
  | { type: 'error'; message: string }

export interface StreamAttempt {
  /** True if a valid event-stream response was consumed end-to-end. */
  ok: boolean
  /** True if we got a terminal event before the stream closed. */
  terminal: 'done' | 'error' | null
  /** The final result, present iff terminal === 'done'. */
  result: ProcessResult | null
  /** Error message, present iff terminal === 'error' or fetch failed. */
  error: string | null
}

interface SubmitParams {
  CDS: string
  name: string
  options: Record<string, unknown>
}

/**
 * Attempt to run a job via the streaming endpoint. Returns detailed outcome
 * so the caller can decide whether to fall back to the non-streaming server
 * action. Events are delivered to `onEvent` in arrival order.
 */
export async function submitJobStream(
  params: SubmitParams,
  onEvent: (ev: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<StreamAttempt> {
  let response: Response
  try {
    response = await fetch('/api/py/process-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(params),
      signal,
    })
  } catch (err) {
    return {
      ok: false,
      terminal: null,
      result: null,
      error: err instanceof Error ? err.message : 'Network error',
    }
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (
    !response.ok ||
    !response.body ||
    !contentType.includes('text/event-stream')
  ) {
    return {
      ok: false,
      terminal: null,
      result: null,
      error: response.ok
        ? 'Stream endpoint unavailable'
        : `HTTP ${response.status}`,
    }
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let terminal: 'done' | 'error' | null = null
  let result: ProcessResult | null = null
  let errorMessage: string | null = null

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let sepIndex: number
      // SSE frames are separated by blank lines. Handle both LF and CRLF.
      while ((sepIndex = buffer.search(/\r?\n\r?\n/)) !== -1) {
        const match = buffer.slice(sepIndex).match(/^\r?\n\r?\n/)
        const frame = buffer.slice(0, sepIndex)
        buffer = buffer.slice(sepIndex + (match?.[0].length ?? 2))
        const ev = parseFrame(frame)
        if (!ev) continue
        onEvent(ev)
        if (ev.type === 'done') {
          terminal = 'done'
          result = ev.result
        } else if (ev.type === 'error') {
          terminal = 'error'
          errorMessage = ev.message
        }
      }
    }
  } catch (err) {
    if (!terminal) {
      return {
        ok: false,
        terminal: null,
        result: null,
        error: err instanceof Error ? err.message : 'Stream read error',
      }
    }
  }

  return {
    ok: terminal === 'done',
    terminal,
    result,
    error: errorMessage,
  }
}

function parseFrame(frame: string): StreamEvent | null {
  let event = ''
  const dataLines: string[] = []
  for (const rawLine of frame.split(/\r?\n/)) {
    if (rawLine.startsWith('event:')) {
      event = rawLine.slice(6).trim()
    } else if (rawLine.startsWith('data:')) {
      dataLines.push(rawLine.slice(5).trimStart())
    }
  }
  if (!event || dataLines.length === 0) return null
  let payload: unknown
  try {
    payload = JSON.parse(dataLines.join('\n'))
  } catch {
    return null
  }
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  if (
    event === 'init' &&
    typeof p.name === 'string' &&
    typeof p.length === 'number'
  ) {
    return { type: 'init', name: p.name, length: p.length }
  }
  if (
    event === 'progress' &&
    typeof p.frac === 'number' &&
    typeof p.stage === 'string'
  ) {
    return { type: 'progress', frac: p.frac, stage: p.stage }
  }
  if (event === 'done') {
    return { type: 'done', result: payload as ProcessResult }
  }
  if (event === 'error' && typeof p.message === 'string') {
    return { type: 'error', message: p.message }
  }
  return null
}
