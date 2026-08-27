-- Migration: Optimise database indices for LingQ Reading Engine
-- Fixes #2317: Covers missing composite sort-filter indices,
-- full-text search (pg_trgm), and tags lookup indices for
-- reading_resources, curated_articles, and curated_dialogues.
--
-- Query patterns analysed from:
--   backend/src/reading-engine/reading-engine.service.ts
--   backend/src/curated-content/curated-content.service.ts
--
-- Problems addressed:
--   1. reading_resources.listResources: filters (language, difficulty, topic)
--      with ORDER BY created_at DESC lack composite indices, causing
--      sequential scan + sort on every listing query.
--   2. curated_articles.getArticles / curated_dialogues.getDialogues:
--      filters (language, cefr_level) with ORDER BY created_at DESC
--      lack composite indices.
--   3. No pg_trgm full-text search indices on curated_articles.content_text
--      or curated_dialogues.lines, preventing efficient text search.
--   4. No GIN index on tags TEXT[] columns for array-containment queries
--      (discovery filtering by topic tags).
--   5. reading_resources.created_by queries for user-owned resource
--      listings lack an index.

-- ── 1. reading_resources: composite sort-filter indices ──────────────────

-- listResources with language filter + ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_reading_resources_language_created
  ON public.reading_resources (language, created_at DESC);

-- listResources with difficulty filter + ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_reading_resources_difficulty_created
  ON public.reading_resources (difficulty, created_at DESC);

-- listResources with topic filter + ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_reading_resources_topic_created
  ON public.reading_resources (topic, created_at DESC);

-- listResources with no filter + ORDER BY created_at DESC (default listing)
CREATE INDEX IF NOT EXISTS idx_reading_resources_created_at
  ON public.reading_resources (created_at DESC);

-- User-owned resource listing: WHERE created_by = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_reading_resources_created_by_created
  ON public.reading_resources (created_by, created_at DESC);

-- ── 2. reading_progress: last_read_at for leaderboard / recent-activity ──
-- The progress table already has a PK on user_id.  A separate index on
-- last_read_at supports "recently active readers" queries without a
-- full sequential scan.

CREATE INDEX IF NOT EXISTS idx_reading_progress_last_read
  ON public.reading_progress (last_read_at DESC)
  WHERE last_read_at IS NOT NULL;

-- ── 3. curated_articles: composite sort-filter indices ───────────────────

-- getArticles with language filter + ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_curated_articles_language_created
  ON public.curated_articles (language, created_at DESC);

-- getArticles with cefr_level filter + ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_curated_articles_cefr_created
  ON public.curated_articles (cefr_level, created_at DESC);

-- getArticles with both filters + ORDER BY created_at DESC (most common pattern)
CREATE INDEX IF NOT EXISTS idx_curated_articles_lang_cefr_created
  ON public.curated_articles (language, cefr_level, created_at DESC);

-- getArticles with no filter + ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_curated_articles_created_at
  ON public.curated_articles (created_at DESC);

-- ── 4. curated_dialogues: composite sort-filter indices ──────────────────

-- getDialogues with language filter + ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_curated_dialogues_language_created
  ON public.curated_dialogues (language, created_at DESC);

-- getDialogues with cefr_level filter + ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_curated_dialogues_cefr_created
  ON public.curated_dialogues (cefr_level, created_at DESC);

-- getDialogues with both filters + ORDER BY created_at DESC (most common pattern)
CREATE INDEX IF NOT EXISTS idx_curated_dialogues_lang_cefr_created
  ON public.curated_dialogues (language, cefr_level, created_at DESC);

-- getDialogues with no filter + ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_curated_dialogues_created_at
  ON public.curated_dialogues (created_at DESC);

-- ── 5. Full-text search via pg_trgm ──────────────────────────────────────
-- Neither curated_articles nor curated_dialogues have pg_trgm indices for
-- content search.  The reading_resources table already has trgm indices
-- on title and content (from 20260808000002_create_reading_engine_tables.sql).

-- Enable pg_trgm on curated_articles.content_text for keyword search
CREATE INDEX IF NOT EXISTS idx_curated_articles_content_trgm
  ON public.curated_articles USING gin (content_text gin_trgm_ops);

-- Enable pg_trgm on curated_articles.title for title search
CREATE INDEX IF NOT EXISTS idx_curated_articles_title_trgm
  ON public.curated_articles USING gin (title gin_trgm_ops);

-- Enable pg_trgm on curated_dialogues.title for title search
CREATE INDEX IF NOT EXISTS idx_curated_dialogues_title_trgm
  ON public.curated_dialogues USING gin (title gin_trgm_ops);

-- Enable pg_trgm on curated_dialogues.lines (JSONB cast to text for keyword
-- search across all speaker lines).  This uses a functional expression index.
CREATE INDEX IF NOT EXISTS idx_curated_dialogues_lines_trgm
  ON public.curated_dialogues USING gin ((lines::text) gin_trgm_ops);

-- ── 6. GIN indices for tags TEXT[] array containment queries ─────────────
-- Frontend discovery filters by tag arrays using the @> (contains) operator.
-- A GIN index makes these queries (tags @> ARRAY['science']) use an index scan
-- instead of a sequential scan.

CREATE INDEX IF NOT EXISTS idx_curated_articles_tags_gin
  ON public.curated_articles USING gin (tags);

CREATE INDEX IF NOT EXISTS idx_curated_dialogues_tags_gin
  ON public.curated_dialogues USING gin (tags);

-- ── 7. word_count index for curated_articles sorting (popular queries) ──
-- Users may want to sort by reading length.
CREATE INDEX IF NOT EXISTS idx_curated_articles_word_count
  ON public.curated_articles (word_count);