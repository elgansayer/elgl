-- Add user_interests and interest_vocabulary tables

CREATE TABLE IF NOT EXISTS user_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tag)
);

CREATE INDEX idx_user_interests_user_id ON user_interests(user_id);
CREATE INDEX idx_user_interests_tag ON user_interests(tag);

CREATE TABLE IF NOT EXISTS interest_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_tag VARCHAR(255) NOT NULL,
  language VARCHAR(10) NOT NULL,
  vocab_word VARCHAR(255) NOT NULL,
  translation VARCHAR(255),
  srs_level INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_interest_vocabulary_tag_lang ON interest_vocabulary(interest_tag, language);
