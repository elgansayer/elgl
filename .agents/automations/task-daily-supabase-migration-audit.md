# Daily Supabase Migration Audit

## Objective

Ensure the database schema remains synchronized, fully indexed, and deployed consistently.

## Instructions

1. Review all recent changes to NestJS entities and `SPEC.md` schema definitions.
2. Cross-reference them against the `supabase/migrations/` folder.
3. If new tables, columns, or PostGIS spatial indices are needed, generate a new SQL migration file following project conventions.
4. Apply the migrations to the local Supabase instance.
5. Run the backend Vitest suite to ensure queries (`pg_trgm`, `ST_Distance`) still succeed against the updated schema.
