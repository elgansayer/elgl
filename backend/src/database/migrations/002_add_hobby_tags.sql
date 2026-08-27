-- Create hobby_tags table
CREATE TABLE IF NOT EXISTS hobby_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🎯',
  target_vocabulary JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_hobby_tags junction table
CREATE TABLE IF NOT EXISTS user_hobby_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hobby_tag_id UUID NOT NULL REFERENCES hobby_tags(id) ON DELETE CASCADE,
  proficiency_level INTEGER DEFAULT 1 CHECK (proficiency_level BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, hobby_tag_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_hobby_tags_user_id ON user_hobby_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_user_hobby_tags_hobby_tag_id ON user_hobby_tags(hobby_tag_id);
CREATE INDEX IF NOT EXISTS idx_hobby_tags_category ON hobby_tags(category);
