-- Migration: Clean up redundant reading engine indices
-- Fixes #2317 (follow-up): Drops old single-column indices that are now
-- subsumed by composite (filter, created_at DESC) indices created in
-- migration 20260808000003_optimise_reading_engine_indices.sql.
--
-- PostgreSQL cannot safely use a (language) index for ORDER BY created_at
-- queries; the new (language, created_at DESC) composite indices cover
-- both filter and sort in a single index scan. Keeping the old indices
-- wastes storage and slows writes without any query benefit.

-- ── reading_resources old single-column indices ─────────────────────────
DROP INDEX IF EXISTS idx_reading_resources_language;
DROP INDEX IF EXISTS idx_reading_resources_difficulty;
DROP INDEX IF EXISTS idx_reading_resources_topic;

-- ── curated_articles old composite index ────────────────────────────────
-- Replaced by idx_curated_articles_lang_cefr_created which covers the same
-- two filter columns plus created_at sort.
DROP INDEX IF EXISTS idx_curated_articles_cefr_language;

-- ── curated_dialogues old composite index ───────────────────────────────
-- Replaced by idx_curated_dialogues_lang_cefr_created which covers the same
-- two filter columns plus created_at sort.
DROP INDEX IF EXISTS idx_curated_dialogues_cefr_language;