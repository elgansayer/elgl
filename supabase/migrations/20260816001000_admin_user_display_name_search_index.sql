-- Support bounded admin display-name investigation using ILIKE '%term%'.
-- pg_trgm is already required by existing discovery migrations.

CREATE INDEX IF NOT EXISTS users_display_name_trgm_idx
    ON public.users USING GIN (display_name gin_trgm_ops);
