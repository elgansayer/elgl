-- Achievements master table
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,
    category TEXT,
    points INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- User‑achievement progress and unlock data
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    progress_state JSONB DEFAULT '{}',
    earned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, achievement_id)
);
