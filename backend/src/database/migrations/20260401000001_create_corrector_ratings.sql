-- Migration: create corrector_ratings table
-- Each user can rate another user (score 1-5) to build a Corrector Score.

CREATE TABLE IF NOT EXISTS corrector_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rated_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(rater_id, rated_user_id)
);

CREATE INDEX idx_corrector_ratings_rated ON corrector_ratings(rated_user_id);
CREATE INDEX idx_corrector_ratings_rater ON corrector_ratings(rater_id);
