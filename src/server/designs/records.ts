import {
  cloudDesignStatusSchema,
  type CloudDesignStatus,
  type CloudDesignSummary,
} from '@/features/design-tool/types/cloud-design'

/**
 * Each account's cloud designs, in the `cloud_design` table of `AUTH_DB`
 * (migrations/0002_cloud_designs.sql), so "My cloud designs" lists them on
 * any device. A Workflow binding reads instances by id but cannot list them
 * by owner; this table is that index and nothing more. The design itself,
 * its inputs and result, stay in the Workflow.
 *
 * Written when a signed-in person submits (an identical resubmission moves
 * it to the top), removed when they delete it or it turns out to be gone.
 * Its `status` is kept up to date wherever the design's state is already
 * known — the step as it starts and settles (./run.ts), and a read that
 * reports something else (./handler.ts) — so the list needs no Workflow read
 * of its own. A row from before the column has none, which the list shows as
 * an unknown state.
 *
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
      `insert into cloud_design (owner, id, name, bases, submitted_at, status)
       values (?1, ?2, ?3, ?4, ?5, ?6)
       on conflict (owner, id) do update set
         name = excluded.name,
         bases = excluded.bases,
         submitted_at = excluded.submitted_at,
         status = excluded.status`,
    )
    .bind(
      owner,
      design.id,
      design.name,
      design.bases,
      design.submittedAt,
      design.status ?? null,
    )
    .run()
}

/**
 * Records where a design got to, for every account listing it: the id is a
 * hash of the request, so two accounts can share one run, and the state
 * belongs to the design rather than to either row. A no-op when nothing
 * lists it, or when the row already says this.
 */
export async function markDesignStatus(
  db: D1Database,
  id: string,
  status: CloudDesignStatus,
): Promise<void> {
  await db
    .prepare(
      `update cloud_design set status = ?2
       where id = ?1 and (status is null or status <> ?2)`,
    )
    .bind(id, status)
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
  status: string | null
}

/** The owner's designs, newest first. */
export async function listDesigns(
  db: D1Database,
  owner: string,
): Promise<CloudDesignSummary[]> {
  const { results } = await db
    .prepare(
      `select id, name, bases, submitted_at, status from cloud_design
       where owner = ?1 order by submitted_at desc limit ?2`,
    )
    .bind(owner, LIST_LIMIT)
    .all<Row>()
  return results.map((row) => ({
    id: row.id,
    name: row.name,
    bases: row.bases,
    submittedAt: row.submitted_at,
    // Anything the column holds that is not one of the four states reads as
    // unknown, which is how a row from before the column reads too.
    status: cloudDesignStatusSchema.safeParse(row.status).data ?? null,
  }))
}
