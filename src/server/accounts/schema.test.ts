// @vitest-environment node
import { getMigrations } from 'better-auth/db/migration'
import { describe, expect, it } from 'vite-plus/test'

import { getAuth } from './auth'
import { createTestD1, migrationSql } from './test-utils'

// The committed migrations are the schema Better Auth needs, no more and no
// less: after applying them, Better Auth's own migration planner, run with
// this app's configuration, finds nothing to create or add. A Better Auth
// upgrade or a new plugin that needs a column fails here, before a deploy
// finds out.

describe('migrations/', () => {
  it('give Better Auth every table and column it needs', async () => {
    const { binding } = createTestD1()
    const auth = getAuth({ AUTH_DB: binding, AUTH_HOSTS: 'rejstudio.com' })
    expect(auth).not.toBeNull()
    const { toBeCreated, toBeAdded } = await getMigrations(auth!.options)
    expect(toBeCreated).toEqual([])
    expect(toBeAdded).toEqual([])
  })

  it('are, for accounts, exactly what Better Auth would create (no hand edits)', async () => {
    const { binding } = createTestD1({ migrate: false })
    const auth = getAuth({ AUTH_DB: binding })
    const planned = await (
      await getMigrations(auth!.options)
    ).compileMigrations()
    const [accounts] = migrationSql()
    const statements = (sql: string) =>
      sql
        .replace(/^--.*$/gm, '')
        .split(';')
        .map((one) => one.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
    expect(statements(accounts)).toEqual(statements(planned))
  })
})
