-- Hobby Tags table
CREATE TABLE IF NOT EXISTS hobby_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'general',
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User-Hobby Tags junction table
CREATE TABLE IF NOT EXISTS user_hobby_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hobby_tag_id UUID NOT NULL REFERENCES hobby_tags(id) ON DELETE CASCADE,
  proficiency_level TEXT CHECK (proficiency_level IN ('beginner', 'intermediate', 'advanced', 'native')) DEFAULT 'beginner',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, hobby_tag_id)
);

-- Vocabulary mapping table (hobby -> target vocabulary words)
CREATE TABLE IF NOT EXISTS hobby_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hobby_tag_id UUID NOT NULL REFERENCES hobby_tags(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  translation TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
  context_sentence TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(hobby_tag_id, word, language)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_hobby_tags_user_id ON user_hobby_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_user_hobby_tags_hobby_tag_id ON user_hobby_tags(hobby_tag_id);
CREATE INDEX IF NOT EXISTS idx_hobby_vocabulary_hobby_tag_id ON hobby_vocabulary(hobby_tag_id);
CREATE INDEX IF NOT EXISTS idx_hobby_tags_name ON hobby_tags(name);

-- Seed default hobby tags
INSERT INTO hobby_tags (name, category, icon) VALUES
  ('Travel', 'lifestyle', '✈️'),
  ('Food & Cooking', 'lifestyle', '🍳'),
  ('Music', 'arts', '🎵'),
  ('Movies & TV', 'entertainment', '🎬'),
  ('Sports', 'fitness', '⚽'),
  ('Technology', 'tech', '💻'),
  ('Fashion', 'lifestyle', '👗'),
  ('Photography', 'arts', '📷'),
  ('Reading', 'arts', '📚'),
  ('Gaming', 'entertainment', '🎮'),
  ('Fitness & Health', 'fitness', '💪'),
  ('Art & Design', 'arts', '🎨'),
  ('Nature & Outdoors', 'lifestyle', '🌿'),
  ('Business', 'professional', '💼'),
  ('Science', 'education', '🔬'),
  ('Languages', 'education', '🗣️'),
  ('Pets & Animals', 'lifestyle', '🐾'),
  ('Dancing', 'arts', '💃'),
  ('Yoga & Meditation', 'fitness', '🧘'),
  ('Cars & Motorcycles', 'tech', '🏎️')
ON CONFLICT (name) DO NOTHING;
