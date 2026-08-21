-- ============================================================================
-- HelloTalk Open-Core Platform
-- Curated Content Database Schema (Articles & Dialogues by CEFR Level)
-- ============================================================================

-- Article table for curated reading content
CREATE TABLE IF NOT EXISTS curated_articles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    cefr_level      TEXT NOT NULL,               -- e.g. 'A1','A2','B1','B2','C1','C2'
    language        TEXT NOT NULL,
    source_url      TEXT,
    content_text    TEXT NOT NULL,
    word_count      INTEGER,
    difficulty_rating INTEGER,
    audio_url       TEXT,
    image_url       TEXT,
    tags            TEXT[],
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dialogue table for curated scripted conversations
CREATE TABLE IF NOT EXISTS curated_dialogues (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    cefr_level      TEXT NOT NULL,
    language        TEXT NOT NULL,
    source_url      TEXT,
    lines           JSONB NOT NULL,             -- array of { speaker, text, translation?, audioUrl? }
    audio_url       TEXT,
    image_url       TEXT,
    tags            TEXT[],
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Speed up filter queries by language and CEFR level
CREATE INDEX IF NOT EXISTS idx_curated_articles_language_cefr
    ON curated_articles (language, cefr_level);
CREATE INDEX IF NOT EXISTS idx_curated_dialogues_language_cefr
    ON curated_dialogues (language, cefr_level);
