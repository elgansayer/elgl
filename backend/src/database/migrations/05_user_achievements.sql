-- Purpose: Define achievements and user_achievements tables
-- Compatible with Supabase (PostgreSQL 15+)

CREATE TABLE IF NOT EXISTS achievements (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT NOT NULL UNIQUE,
    title       TEXT NOT NULL,
    description TEXT,
    category    TEXT,
    points      INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_achievements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id  UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at       TIMESTAMP WITH TIME ZONE DEFAULT now(),
    progress_json   JSONB,
    UNIQUE (user_id, achievement_id)
);

-- Indexes for common lookup queries
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id
    ON user_achievements (user_id);

CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id
    ON user_achievements (achievement_id);
