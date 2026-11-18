import type { CloudDesignSummary } from '@/features/design-tool/types/cloud-design'

/**
 * Each account's cloud designs, in the `cloud_design` table of `AUTH_DB`
 * (migrations/0002_cloud_designs.sql), so "My cloud designs" lists them on
 * any device. A Workflow binding reads instances by id but cannot list them
 * by owner; this table is that index and nothing more. The design itself,
 * its inputs and result, stay in the Workflow.
 *
 * Written when a signed-in person submits (an identical resubmission moves
 * it to the top), removed when they delete it or it turns out to be gone.
 * An entry can outlive its design (retention ran out); the reader treats a
 * design that is not found as gone, and the next delete clears the entry.
 */

/** The most a list returns: far more than anyone keeps for 30 days. */
const LIST_LIMIT = 200

export async function recordDesign(
  db: D1Database,
  owner: string,
  design: CloudDesignSummary,
): Promise<void> {
  await db
    .prepare(
      `insert into cloud_design (owner, id, name, bases, submitted_at)
       values (?1, ?2, ?3, ?4, ?5)
       on conflict (owner, id) do update set
         name = excluded.name,
         bases = excluded.bases,
         submitted_at = excluded.submitted_at`,
    )
    .bind(owner, design.id, design.name, design.bases, design.submittedAt)
    .run()
}

export async function forgetDesign(
  db: D1Database,
  owner: string,
  id: string,
): Promise<void> {
  await db
    .prepare('delete from cloud_design where owner = ?1 and id = ?2')
    .bind(owner, id)
    .run()
}

interface Row {
  id: string
  name: string
  bases: number
  submitted_at: string
}

/** The owner's designs, newest first. */
export async function listDesigns(
  db: D1Database,
  owner: string,
): Promise<CloudDesignSummary[]> {
  const { results } = await db
    .prepare(
      `select id, name, bases, submitted_at from cloud_design
       where owner = ?1 order by submitted_at desc limit ?2`,
    )
    .bind(owner, LIST_LIMIT)
    .all<Row>()
  return results.map((row) => ({
    id: row.id,
    name: row.name,
    bases: row.bases,
    submittedAt: row.submitted_at,
  }))
}
