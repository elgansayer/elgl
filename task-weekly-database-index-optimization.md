# Weekly Database Index & Query Optimization

## Objective
Maintain rapid query performance for the Discovery PostGIS and LingQ search endpoints.

## Instructions
1. Audit the Supabase query logic (`ST_Distance`, `pg_trgm` full-text search).
2. Check if any new tables or frequently accessed columns are missing foreign keys or indices.
3. Review `backend/src/` for missing query optimizations or unnecessary eagerly loaded relations.
4. Add a migration via the `supabase-migration` skill if an index is missing.
