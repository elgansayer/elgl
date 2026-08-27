---
name: supabase-migration
description: "Write a new Supabase PostgreSQL migration for the HelloTalk clone under supabase/migrations, following this project's PostGIS, pg_trgm, indexing, and naming conventions. Use when adding a new table, column, index, or RPC function to the database schema."
---

# Supabase Migration

## When to Use

- Adding a new table, altering an existing table, adding an index, or adding a Postgres function/RPC used by the backend (e.g. `search_nearby_users`).

## Naming & Location

`supabase/migrations/<NNN>_<snake_case_description>.sql` - zero-padded 3-digit sequence continuing from the highest existing number (currently up to `008_local_dev_seed_tables.sql`). Never renumber or edit a migration that has already shipped; add a new one.

## Conventions (copy the style of existing migrations, e.g. `006_audio_rooms.sql`)

```sql
CREATE TABLE IF NOT EXISTS public.<table_name> (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    <fk_column> UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    <col> VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS <table>_<col>_idx ON public.<table_name> (<col>, created_at DESC);
```

- Always `IF NOT EXISTS` on `CREATE TABLE`/`CREATE INDEX` for idempotent re-runs.
- Foreign keys reference `public.users(id)` with an explicit `ON DELETE` policy (`CASCADE` for owned child rows like messages/comments/visits).
- Timestamps are `TIMESTAMPTZ NOT NULL DEFAULT now()`, never bare `TIMESTAMP`.
- Arrays (`target_languages`, `speakers`, `raised_hands`) use native Postgres array columns (`UUID[]`, `TEXT[]`), not JSON, when the values are simple scalars.
- Use `JSONB` (not `JSON`) for variable-shape payloads (`content_json`, `correction_payload`, `item_payload`).

## PostGIS (geospatial)

- Location columns are `geography(Point, 4326)`.
- Spatial filtering must go through `ST_DWithin(location, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), :radius_metres)`, never manual bounding-box math.
- Prefer wrapping proximity search in a `CREATE OR REPLACE FUNCTION` (e.g. `search_nearby_users(search_lat, search_lon, radius_m, exclude_user_id, filter_native, filter_target, serious_only)`) called from the backend via `supabase.rpc('fn_name', {...})` (see `backend/src/discovery/discovery.service.ts`), rather than building the geospatial `WHERE` clause with the JS query builder.
- Add a GiST index on any new geography column: `CREATE INDEX ... USING GIST (location);`.

## Full-Text Search (`pg_trgm`)

- Enable trigram search on searchable text columns with a GIN index: `CREATE INDEX ... ON public.<table> USING GIN (<col> gin_trgm_ops);` (used for chat message search and moments search).

## Row Level Security

- If a table is ever queried directly by a Supabase client (should be rare - see the API-First mandate), it must have RLS enabled and policies scoped to `auth.uid()`. Per `AGENTS.md` Section 4, the Angular frontend never queries Supabase directly - all access goes through the NestJS API using the service-role key, so most new tables only need RLS if there's a legitimate direct-client read path (e.g. Supabase Auth's own `auth.users`).

## After Writing a Migration

- Update `backend/src/database/seed.ts` if the new table needs local dev seed data.
- Update `SPEC.md` Section 1 with the new table definition so the schema documentation stays authoritative.
- If the migration backs a new feature, also follow the `nestjs-feature-module` skill for the API layer.
