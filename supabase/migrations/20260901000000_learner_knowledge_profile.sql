-- Unified Learner Knowledge Model Schema

CREATE TABLE IF NOT EXISTS learner_knowledge_profiles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL,
  overall_proficiency VARCHAR(20) DEFAULT 'A1',
  speaking_score NUMERIC(3, 2) DEFAULT 0.0 CHECK (speaking_score >= 0 AND speaking_score <= 1),
  listening_score NUMERIC(3, 2) DEFAULT 0.0 CHECK (listening_score >= 0 AND listening_score <= 1),
  reading_score NUMERIC(3, 2) DEFAULT 0.0 CHECK (reading_score >= 0 AND reading_score <= 1),
  writing_score NUMERIC(3, 2) DEFAULT 0.0 CHECK (writing_score >= 0 AND writing_score <= 1),
  grammar_score NUMERIC(3, 2) DEFAULT 0.0 CHECK (grammar_score >= 0 AND grammar_score <= 1),
  vocabulary_score NUMERIC(3, 2) DEFAULT 0.0 CHECK (vocabulary_score >= 0 AND vocabulary_score <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, language)
);

CREATE TABLE IF NOT EXISTS knowledge_items (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL,
  item_id VARCHAR(255) NOT NULL,
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('vocabulary', 'grammar', 'phrase')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('new', 'learning', 'known', 'struggling')),
  confidence_score NUMERIC(5, 2) DEFAULT 0.0,
  error_frequency NUMERIC(5, 2) DEFAULT 0.0,
  source_ids JSONB DEFAULT '{}',
  last_encountered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, language, item_id),
  FOREIGN KEY (user_id, language) REFERENCES learner_knowledge_profiles(user_id, language) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recent_encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL,
  topic VARCHAR(255) NOT NULL,
  source VARCHAR(50) NOT NULL CHECK (source IN ('ai_conversation', 'lesson', 'moment')),
  encountered_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id, language) REFERENCES learner_knowledge_profiles(user_id, language) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX idx_knowledge_items_status ON knowledge_items(user_id, language, status);
CREATE INDEX idx_recent_encounters_user_lang ON recent_encounters(user_id, language, encountered_at DESC);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_learner_knowledge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_learner_knowledge_profiles
  BEFORE UPDATE ON learner_knowledge_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_learner_knowledge_updated_at();

CREATE TRIGGER trigger_update_knowledge_items
  BEFORE UPDATE ON knowledge_items
  FOR EACH ROW
  EXECUTE FUNCTION update_learner_knowledge_updated_at();

-- RLS Policies
ALTER TABLE learner_knowledge_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recent_encounters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own learner knowledge profiles"
  ON learner_knowledge_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read their own knowledge items"
  ON knowledge_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read their own recent encounters"
  ON recent_encounters FOR SELECT
  USING (auth.uid() = user_id);

-- Backend service role needs full access
CREATE POLICY "Service role full access learner_knowledge_profiles"
  ON learner_knowledge_profiles FOR ALL
  USING (current_role = 'service_role');

CREATE POLICY "Service role full access knowledge_items"
  ON knowledge_items FOR ALL
  USING (current_role = 'service_role');

CREATE POLICY "Service role full access recent_encounters"
  ON recent_encounters FOR ALL
  USING (current_role = 'service_role');
