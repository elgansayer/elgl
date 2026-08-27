-- Adds tables for curated learning content: articles and dialogues graded by CEFR level.

CREATE TABLE IF NOT EXISTS curated_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    cefr_level TEXT NOT NULL CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
    language TEXT NOT NULL CHECK (char_length(language)=2),
    source_url TEXT,
    content_text TEXT NOT NULL,
    word_count INTEGER,
    difficulty_rating INTEGER DEFAULT 0,
    audio_url TEXT,
    image_url TEXT,
    tags TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS curated_dialogues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    cefr_level TEXT NOT NULL CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
    language TEXT NOT NULL CHECK (char_length(language)=2),
    source_url TEXT,
    lines JSONB NOT NULL,
    audio_url TEXT,
    image_url TEXT,
    tags TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_curated_articles_cefr ON curated_articles (cefr_level, language);
CREATE INDEX idx_curated_dialogues_cefr ON curated_dialogues (cefr_level, language);
