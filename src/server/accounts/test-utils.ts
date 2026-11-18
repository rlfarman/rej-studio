// Test doubles for accounts: a D1 database on node:sqlite with the real
// migrations applied, a `send_email` binding that keeps what it is given,
// and a sign-in through Better Auth's real endpoints.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'

import type { ServerEnv } from '../env'
import { handleAuth } from './handler'

const MIGRATIONS = join(import.meta.dirname, '../../../migrations')

/** The migrations as wrangler applies them: every .sql file, in name order. */
export function migrationSql(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => readFileSync(join(MIGRATIONS, name), 'utf8'))
}

/**
 * The slice of D1's API that Better Auth's D1 dialect and ./records use,
 * over an in-memory SQLite database. Close enough for logic tests; the real
 * D1 runs in `pnpm test:worker` and the end-to-end tests.
 */
export function createTestD1({ migrate = true } = {}): {
  binding: D1Database
  sqlite: DatabaseSync
} {
  const sqlite = new DatabaseSync(':memory:')
  if (migrate) for (const sql of migrationSql()) sqlite.exec(sql)

  const statement = (sql: string, params: SQLInputValue[] = []) => {
    const run = () => {
      const prepared = sqlite.prepare(sql)
      if (prepared.columns().length > 0) {
        const rows = prepared.all(...params) as Record<string, unknown>[]
        return { rows, changes: rows.length, lastRowId: null }
      }
      const result = prepared.run(...params)
      return {
        rows: [] as Record<string, unknown>[],
        changes: Number(result.changes),
        lastRowId: Number(result.lastInsertRowid),
      }
    }
    const all = async () => {
      const { rows, changes, lastRowId } = run()
      return {
        success: true,
        results: rows,
        meta: { changes, last_row_id: lastRowId },
      }
    }
    return {
      bind: (...values: unknown[]) =>
        statement(
          sql,
          values.map((value) =>
            typeof value === 'boolean' ? Number(value) : value,
          ) as SQLInputValue[],
        ),
      all,
      run: all,
      first: async (column?: string) => {
        const row = run().rows[0] ?? null
        return column && row ? row[column] : row
      },
      raw: async () => run().rows.map((row) => Object.values(row)),
    }
  }

  const binding = {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: { all: () => Promise<unknown> }[]) => {
      const results = []
      for (const one of statements) results.push(await one.all())
      return results
    },
    exec: async (sql: string) => {
      sqlite.exec(sql)
      return { count: 1, duration: 0 }
    },
  }
  return { binding: binding as unknown as D1Database, sqlite }
}

/** A `send_email` binding that keeps every message it is asked to send. */
export function fakeEmail() {
  const sent: { to: string; from: unknown; subject: string; text: string }[] =
    []
  return {
    sent,
    binding: {
      send: async (message: (typeof sent)[number]) => {
        sent.push(message)
        return { messageId: `test-${sent.length}` }
      },
    } as unknown as SendEmail,
    /** The code in the last message to `to`. */
    codeFor(to: string): string {
      const message = sent.findLast((one) => one.to === to)
      const code = /\b(\d{6})\b/.exec(message?.subject ?? '')?.[1]
      if (!code) throw new Error(`no sign-in code sent to ${to}`)
      return code
    },
  }
}

/** The `name=value` pairs a response sets, joined as a Cookie header. */
function cookiesFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

/**
 * Signs `email` in through Better Auth's endpoints, as the dialog does: ask
 * for a code, read it from the mailbox, send it back. Returns the account's
 * cookie and its user id.
 */
export async function signInWithCode(
  env: ServerEnv,
  mailbox: ReturnType<typeof fakeEmail>,
  email: string,
  site = 'http://localhost:3000',
): Promise<{ cookie: string; userId: string }> {
  const post = (path: string, body: unknown) =>
    handleAuth(
      new Request(`${site}/api/auth${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: site },
        body: JSON.stringify(body),
      }),
      env,
    )
  const sent = await post('/email-otp/send-verification-otp', {
    email,
    type: 'sign-in',
  })
  if (!sent.ok)
    throw new Error(`send code: ${sent.status} ${await sent.text()}`)
  const signedIn = await post('/sign-in/email-otp', {
    email,
    otp: mailbox.codeFor(email),
  })
  if (!signedIn.ok) {
    throw new Error(`sign in: ${signedIn.status} ${await signedIn.text()}`)
  }
  const { user } = (await signedIn.clone().json()) as { user: { id: string } }
  return { cookie: cookiesFrom(signedIn), userId: user.id }
}

/** `db`, except that preparing a statement `fails` matches throws. */
export function failingD1(
  db: D1Database,
  fails: (sql: string) => boolean = () => true,
): D1Database {
  return {
    batch: (statements: D1PreparedStatement[]) => db.batch(statements),
    exec: (sql: string) => db.exec(sql),
    prepare: (sql: string) => {
      if (fails(sql)) throw new Error('D1 is down')
      return db.prepare(sql)
    },
  } as unknown as D1Database
}
