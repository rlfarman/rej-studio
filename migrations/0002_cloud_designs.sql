-- Each account's cloud designs, so "My cloud designs" can list them on any
-- device: a Workflow binding can read an instance by id but cannot list
-- instances by owner. Written when a signed-in person submits a design and
-- removed when they delete it (src/server/designs/records.ts). The design
-- itself stays in the Workflow; this is only the index.
--
-- Keyed by owner and id together: two people who submit the identical
-- design share one run (the id is a hash of the request), and each lists it.

create table "cloud_design" (
  "owner" text not null,
  "id" text not null,
  "name" text not null,
  "bases" integer not null,
  "submitted_at" text not null,
  primary key ("owner", "id")
);

create index "cloud_design_owner_submitted_idx" on "cloud_design" ("owner", "submitted_at" desc);
