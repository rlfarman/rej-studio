/**
 * Structured logger. In production (server-side), outputs newline-delimited
 * JSON for log aggregation (Axiom, Datadog, CloudWatch, etc.). In development
 * or in the browser, falls back to human-readable console output.
 *
 * Usage:
 *   const log = createLogger('job-watcher')
 *   log.info('polling started', { jobId })
 *   log.error('poll failed', err, { jobId })
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

interface Logger {
  debug: (msg: string, context?: LogContext) => void
  info: (msg: string, context?: LogContext) => void
  warn: (msg: string, context?: LogContext) => void
  error: (msg: string, error?: unknown, context?: LogContext) => void
}

const isServer = typeof window === 'undefined'
const isProduction = process.env.NODE_ENV === 'production'
const useJson = isServer && isProduction

function emitJson(
  level: LogLevel,
  scope: string,
  msg: string,
  extras: LogContext,
) {
  const entry = JSON.stringify({
    level,
    scope,
    msg,
    ts: new Date().toISOString(),
    ...(Object.keys(extras).length > 0 ? extras : undefined),
  })
  // Use stderr for warn/error so log routers can split by stream
  if (level === 'error' || level === 'warn') {
    process.stderr.write(entry + '\n')
  } else {
    process.stdout.write(entry + '\n')
  }
}

function emitConsole(
  level: LogLevel,
  scope: string,
  msg: string,
  extras: LogContext,
) {
  const prefix = `[${scope}]`
  const payload = Object.keys(extras).length > 0 ? extras : undefined
  const sink = console[level] ?? console.log
  if (payload) {
    sink(prefix, msg, payload)
  } else {
    sink(prefix, msg)
  }
}

const emit = useJson ? emitJson : emitConsole

function serializeError(error: unknown): LogContext {
  if (error instanceof Error) {
    return { error: error.message, stack: error.stack }
  }
  return { error: String(error) }
}

export function createLogger(scope: string): Logger {
  return {
    debug: (msg, context = {}) => emit('debug', scope, msg, context),
    info: (msg, context = {}) => emit('info', scope, msg, context),
    warn: (msg, context = {}) => emit('warn', scope, msg, context),
    error: (msg, error, context = {}) =>
      emit('error', scope, msg, {
        ...(error !== undefined ? serializeError(error) : {}),
        ...context,
      }),
  }
}
