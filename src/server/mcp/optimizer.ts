// The optimizer, running inside the Worker.
//
// The same `.wasm` the browser runs, through the same ABI wrapper
// (design-tool/workers/optimizer-abi.ts) and validated with the same zod
// contract, so an agent's design and a design in the app are the same design.
//
// The module is imported statically rather than fetched: workerd cannot
// compile WebAssembly from bytes at runtime, and the Cloudflare Vite plugin
// turns a `.wasm` import into a CompiledWasm module (a `WebAssembly.Module`)
// that is part of the Worker bundle.

import optimizerModule from '../../../public/optimizer/rej-optimizer.wasm'

import {
  loadOptimizer,
  optimizerErrorCode,
  optimizerErrorOf,
  type LoadedOptimizer,
} from '@/features/design-tool/workers/optimizer-abi'
import {
  processResultSchema,
  type ProcessOptions,
} from '@/features/design-tool/types/optimizer-contract'
import type { ProcessResult } from '@/features/design-tool/types/process-result'

/**
 * Instantiated once per isolate: instantiation costs a compile of a 150 KB
 * module, and the module holds no state between runs.
 */
let optimizer: Promise<LoadedOptimizer> | null = null

function instance(): Promise<LoadedOptimizer> {
  optimizer ??= loadOptimizer((imports) =>
    WebAssembly.instantiate(optimizerModule, imports),
  )
  return optimizer
}

export type DesignOutcome =
  | { ok: true; result: ProcessResult; seconds: number }
  | { ok: false; code: 'invalid_input' | 'backend'; message: string }

/**
 * Run one design. Never rejects: a refusal by the optimizer and a crash both
 * come back as `ok: false`, since either is a tool result, not a 500.
 *
 * `processing_time_seconds` is zero in WebAssembly (rust/README.md), so the
 * caller is timed here instead.
 */
export async function designOnWorker(params: {
  CDS: string
  name: string
  options: ProcessOptions
}): Promise<DesignOutcome> {
  const started = Date.now()
  let parsed: unknown
  try {
    parsed = (await instance()).design(params)
  } catch (error) {
    return {
      ok: false,
      code: 'backend',
      message: error instanceof Error ? error.message : 'the optimizer failed',
    }
  }

  const error = optimizerErrorOf(parsed)
  if (error !== null) {
    return { ok: false, code: optimizerErrorCode(error), message: error }
  }

  // Parsed with the browser's schema, so a contract mismatch surfaces here
  // rather than as a half-filled result in someone's chat.
  const result = processResultSchema.safeParse(parsed)
  if (!result.success) {
    return {
      ok: false,
      code: 'backend',
      message: 'the optimizer returned a result in an unexpected shape',
    }
  }
  return {
    ok: true,
    result: result.data,
    seconds: (Date.now() - started) / 1000,
  }
}

/** The DNA a protein reverse-translates to, or why it could not. */
export async function reverseTranslateOnWorker(
  protein: string,
  species: string,
): Promise<{ ok: true; CDS: string } | { ok: false; message: string }> {
  let parsed: unknown
  try {
    parsed = (await instance()).reverseTranslate({ protein, species })
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'the optimizer failed',
    }
  }
  const error = optimizerErrorOf(parsed)
  if (error !== null) return { ok: false, message: error }
  const cds =
    parsed && typeof parsed === 'object' && 'CDS' in parsed
      ? (parsed as { CDS: unknown }).CDS
      : null
  return typeof cds === 'string'
    ? { ok: true, CDS: cds }
    : { ok: false, message: 'the optimizer returned no coding sequence' }
}
