// Historical compatibility required only to replay the surviving migration corpus
// from zero. Source migration SQL remains byte-for-byte unchanged. Every entry is
// inserted immediately before the named source migration and is hashed into the
// replay manifest by scripts/prepare-supabase-clean-replay.mjs.
export const compatibilityShims = [
  {
    beforeSourceFile: '014_chat_rooms_table.sql',
    name: 'remove_legacy_local_chat_rooms_placeholder',
    reason:
      '008_local_dev_seed_tables.sql defines chat_rooms.id as TEXT; 014_chat_rooms_table.sql establishes the production UUID contract.',
    sql: `DO $$
DECLARE
  existing_id_type text;
BEGIN
  IF to_regclass('public.chat_rooms') IS NOT NULL THEN
    SELECT format_type(attribute.atttypid, attribute.atttypmod)
      INTO existing_id_type
      FROM pg_attribute AS attribute
      WHERE attribute.attrelid = 'public.chat_rooms'::regclass
        AND attribute.attname = 'id'
        AND NOT attribute.attisdropped;

    IF existing_id_type = 'text' THEN
      DROP TABLE public.chat_rooms;
    END IF;
  END IF;
END
$$;
`,
  },
  {
    beforeSourceFile: '20260807000001_create_audio_room_notes.sql',
    name: 'add_audio_rooms_is_archived_before_notes_policy',
    reason:
      '20260807000001_create_audio_room_notes.sql references audio_rooms.is_archived before the historical migration corpus defines that column; the forward migration later in the corpus makes the contract explicit for deployed databases.',
    sql: `ALTER TABLE public.audio_rooms
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
`,
  },
  {
    beforeSourceFile: '20260807143544_review_rls_srs_flashcards.sql',
    name: 'materialize_typeorm_flashcard_decks_before_rls_review',
    reason:
      'The RLS review expects decks and deck_flashcards created by backend/src/database/migrations/20260801000000-create-flashcard-decks.ts, which is outside the Supabase SQL corpus.',
    sql: `CREATE TABLE IF NOT EXISTS public.decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  colour TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT '📚',
  card_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_decks_user_id ON public.decks(user_id);
CREATE TABLE IF NOT EXISTS public.deck_flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  flashcard_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(deck_id, flashcard_id)
);
CREATE INDEX IF NOT EXISTS idx_deck_flashcards_deck_id ON public.deck_flashcards(deck_id);
CREATE INDEX IF NOT EXISTS idx_deck_flashcards_flashcard_id ON public.deck_flashcards(flashcard_id);
`,
  },
  {
    beforeSourceFile: '20260807152902_review_rls_matchmaking.sql',
    name: 'materialize_legacy_matchmaking_interest_tables_before_rls_review',
    reason:
      'The historical RLS review expects user_interests and interest_vocabulary tables absent from the surviving root Supabase SQL corpus; the following index migration requires user_id/tag and canonical_tag.',
    sql: `CREATE TABLE IF NOT EXISTS public.user_interests (
  user_id UUID NOT NULL,
  tag TEXT NOT NULL,
  UNIQUE(user_id, tag)
);
CREATE TABLE IF NOT EXISTS public.interest_vocabulary (
  canonical_tag TEXT NOT NULL
);
`,
  },
  {
    beforeSourceFile: '20260807160000_review_rls_lingq_reading_engine.sql',
    name: 'materialize_typeorm_curated_content_before_rls_review',
    reason:
      'The LingQ RLS review expects curated_articles and curated_dialogues created by backend/src/database/migrations/20260731000003-create-curated-content.ts outside the Supabase SQL corpus.',
    sql: `CREATE TABLE IF NOT EXISTS public.curated_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  cefr_level TEXT NOT NULL,
  language TEXT NOT NULL,
  content_text TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  difficulty_rating INTEGER NOT NULL DEFAULT 1,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.curated_dialogues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  cefr_level TEXT NOT NULL,
  language TEXT NOT NULL,
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_curated_articles_cefr_language ON public.curated_articles(cefr_level, language);
CREATE INDEX IF NOT EXISTS idx_curated_dialogues_cefr_language ON public.curated_dialogues(cefr_level, language);
`,
  },
  {
    beforeSourceFile: '20260807190000_review_rls_video_classrooms.sql',
    name: 'materialize_typeorm_quick_polls_before_rls_review',
    reason:
      'The video-classroom RLS review expects quick_polls and poll_votes created by backend/src/database/migrations/20260730000001-create-quick-polls.ts outside the Supabase SQL corpus.',
    sql: `CREATE TABLE IF NOT EXISTS public.quick_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.audio_rooms(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options TEXT[] NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.quick_polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_quick_polls_room_id ON public.quick_polls(room_id);
CREATE INDEX IF NOT EXISTS idx_quick_polls_host_id ON public.quick_polls(host_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON public.poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user_id ON public.poll_votes(user_id);
`,
  },
  {
    beforeSourceFile: '20260808000001_optimise_escrow_indices.sql',
    name: 'add_escrow_reference_id_before_index_optimisation',
    reason:
      '20260807000000_create_escrow_transactions.sql creates escrow_transactions without reference_id, while the following optimiser immediately indexes it.',
    sql: `ALTER TABLE public.escrow_transactions
  ADD COLUMN IF NOT EXISTS reference_id TEXT;
`,
  },
  {
    beforeSourceFile: '20260808000002_optimise_video_classroom_indices.sql',
    name: 'restore_audio_room_discovery_contract_before_optimisation',
    reason:
      '006_audio_rooms.sql predates language-party discovery; current DTO/service contracts and the optimiser require party_type, language_pair, topic_tag, level and is_video_stream.',
    sql: `ALTER TABLE public.audio_rooms
  ADD COLUMN IF NOT EXISTS party_type TEXT,
  ADD COLUMN IF NOT EXISTS language_pair TEXT,
  ADD COLUMN IF NOT EXISTS topic_tag TEXT,
  ADD COLUMN IF NOT EXISTS level TEXT,
  ADD COLUMN IF NOT EXISTS is_video_stream BOOLEAN NOT NULL DEFAULT false;
`,
  },
  {
    beforeSourceFile: '20260808000002_optimise_video_classroom_indices.sql',
    name: 'reconcile_duplicate_video_classroom_policies_before_optimisation',
    reason:
      'The preceding video-classroom RLS review creates four policy names that the optimiser recreates without first dropping them.',
    sql: `DROP POLICY IF EXISTS call_logs_select_own ON public.call_logs;
DROP POLICY IF EXISTS call_logs_insert_own ON public.call_logs;
DROP POLICY IF EXISTS audio_room_tips_select_own ON public.audio_room_tips;
DROP POLICY IF EXISTS audio_room_tips_insert_own ON public.audio_room_tips;
`,
  },
  {
    beforeSourceFile: '20260808000002_review_rls_escrow_payments.sql',
    name: 'reconcile_escrow_recipient_column_before_rls_review',
    reason:
      'The root Supabase escrows migration uses receiver_id while the surviving backend/supabase escrows contract and the later RLS review use recipient_id.',
    sql: `ALTER TABLE public.escrows
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
UPDATE public.escrows
  SET recipient_id = receiver_id
  WHERE recipient_id IS NULL;
ALTER TABLE public.escrows
  ALTER COLUMN recipient_id SET NOT NULL;
`,
  },
  {
    beforeSourceFile: '20260808000003_optimise_discovery_indices.sql',
    name: 'restore_discovery_profile_columns_before_optimisation',
    reason:
      'The active DiscoveryService filters users by country/city/interests and the optimiser indexes/returns those fields, but the surviving root migration corpus never materializes them.',
    sql: `ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS interests VARCHAR(50)[];
`,
  },
  {
    beforeSourceFile: '20260808000003_optimise_video_classroom_indices.sql',
    name: 'reconcile_duplicate_call_log_indices_before_second_optimiser',
    reason:
      '20260808000002_optimise_video_classroom_indices.sql already creates idx_call_logs_caller_type_started and idx_call_logs_receiver_type_started, while the immediately following optimiser drops different legacy names and recreates these two names without IF NOT EXISTS.',
    sql: `DROP INDEX IF EXISTS public.idx_call_logs_caller_type_started;
DROP INDEX IF EXISTS public.idx_call_logs_receiver_type_started;
`,
  },
  {
    beforeSourceFile: '20260808000003_optimise_video_classroom_indices.sql',
    name: 'restore_audio_room_invited_users_before_gin_index',
    reason:
      'The historical video-classroom optimiser creates its invited_user_ids GIN index before the same source migration reaches the idempotent ALTER TABLE that adds invited_user_ids.',
    sql: `ALTER TABLE public.audio_rooms
  ADD COLUMN IF NOT EXISTS invited_user_ids UUID[];
`,
  },
  {
    beforeSourceFile: '20260808000003_restrict_search_nearby_users_columns.sql',
    name: 'retire_richer_discovery_rpc_before_legacy_security_rewrite',
    reason:
      'The immediately preceding discovery optimiser introduces the active 12-argument search_nearby_users overload, then the historical column-restriction migration creates a 7-argument overload and uses an unqualified COMMENT ON FUNCTION, which PostgreSQL rejects while both overloads exist. The forward convergence migration later restores only the active 12-argument RPC used by DiscoveryService.',
    sql: `DROP FUNCTION IF EXISTS public.search_nearby_users(
  double precision,
  double precision,
  double precision,
  uuid,
  character varying[],
  character varying,
  boolean,
  character varying,
  character varying,
  integer,
  integer,
  boolean
);
`,
  },
  {
    beforeSourceFile: '20260808000004_finalise_rls_discovery_map.sql',
    name: 'remove_discovery_rpc_before_broken_historical_drop_loop',
    reason:
      'The historical finalise migration reconstructs DROP FUNCTION text from regprocedure by appending a second closing parenthesis, so its dynamic SQL is syntactically invalid whenever any search_nearby_users overload exists. Removing the temporary legacy overload makes that loop empty; the migration then creates its intended definitive 12-argument function.',
    sql: `DROP FUNCTION IF EXISTS public.search_nearby_users(
  double precision,
  double precision,
  double precision,
  uuid,
  character varying,
  character varying,
  boolean
);
DROP FUNCTION IF EXISTS public.search_nearby_users(
  double precision,
  double precision,
  double precision,
  uuid,
  character varying[],
  character varying,
  boolean,
  character varying,
  character varying,
  integer,
  integer,
  boolean
);
`,
  },
  {
    beforeSourceFile: '20260808000004_optimise_matchmaking_indices.sql',
    name: 'add_is_deleted_before_matchmaking_partial_index',
    reason:
      'The matchmaking optimiser filters its partial users index on is_deleted two historical steps before 20260808000006_add_is_deleted_to_users.sql materializes that GDPR finalisation flag.',
    sql: `ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
`,
  },
];