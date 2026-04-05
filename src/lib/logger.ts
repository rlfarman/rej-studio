/**
 * Structured client-side logger. Thin wrapper over console that tags every
 * message with a scope and surfaces errors in a consistent shape.
 *
 * Usage:
 *   const log = createLogger('job-watcher')
 *   log.info('polling started', { jobId })
 *   log.error('poll failed', err, { jobId })
 *
 * Kept intentionally small — swap the sink here if we later add remote
 * reporting (Sentry, etc.) without touching call sites.
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

function emit(level: LogLevel, scope: string, msg: string, extras: LogContext) {
  const prefix = `[${scope}]`
  const payload = Object.keys(extras).length > 0 ? extras : undefined
  const sink = console[level] ?? console.log
  if (payload) {
    sink(prefix, msg, payload)
  } else {
    sink(prefix, msg)
  }
}

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
