-- Where each listed cloud design got to, so "My cloud designs" can show a
-- state per entry without reading the Workflow. A Workflow binding reads an
-- instance by id but cannot list instances by owner, which is why this index
-- exists at all (migrations/0002_cloud_designs.sql); a dot per row would
-- otherwise cost one `instance.status()` call per row on every list.
--
-- Written where the state is already known (src/server/designs/): on submit,
-- by the Workflow's step as the run starts and settles, and whenever a read
-- of the design reports something else. One of 'queued', 'running',
-- 'completed' or 'failed' — the four a design can be in
-- (features/design-tool/types/cloud-design.ts).
--
-- Existing rows get null, not a guess. They were written on submit and have
-- since settled in a way nothing recorded, so their true state is unknown:
-- null is the honest value, the list says only that the design is in the
-- cloud (as it did before this column), and it claims no expiry date. The
-- first read of such a design fills it in.

alter table "cloud_design" add column "status" text;
