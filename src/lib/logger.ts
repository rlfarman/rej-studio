/**
 * Scoped console logger. Everything runs in the browser, so this is a thin
 * prefix over `console`; error boundaries report through it.
 *
 * Usage:
 *   const log = createLogger('browser-optimizer')
 *   log.warn('could not pre-warm the optimizer worker', { reason })
 *   log.error('optimizer worker crashed', err)
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
