import { createHash } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, join } from 'node:path';

const [sourceDirectory, outputDirectory, manifestPath] = process.argv.slice(2);

if (!sourceDirectory || !outputDirectory || !manifestPath) {
  console.error(
    'Usage: node scripts/prepare-supabase-clean-replay.mjs <source-dir> <output-dir> <manifest-path>',
  );
  process.exit(2);
}

const migrationPattern = /^(\d{3}|\d{8}|\d{14})_(.+)\.sql$/;
const files = readdirSync(sourceDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  throw new Error(`No SQL migrations found in ${sourceDirectory}`);
}

// Deployed migration files are append-only, but the historical corpus contains
// a small number of ordering/schema assumptions that make a clean replay
// impossible. CI keeps every source migration byte-for-byte and inserts only
// explicit, narrowly-scoped compatibility shims. Each shim is hashed and listed
// in the replay manifest so the normalized history is reviewable rather than
// silently rewritten.
const compatibilityShims = [
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
      'The RLS review expects decks and deck_flashcards created by backend/src/database/migrations/20260801000000-create-flashcard-decks.ts, which is outside the Supabase SQL migration corpus. The shim mirrors that migration before the RLS review.',
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

CREATE INDEX IF NOT EXISTS idx_deck_flashcards_deck_id
  ON public.deck_flashcards(deck_id);
CREATE INDEX IF NOT EXISTS idx_deck_flashcards_flashcard_id
  ON public.deck_flashcards(flashcard_id);
`,
  },
  {
    beforeSourceFile: '20260807152902_review_rls_matchmaking.sql',
    name: 'materialize_legacy_matchmaking_interest_tables_before_rls_review',
    reason:
      'The historical RLS review expects user_interests and interest_vocabulary tables that are absent from the surviving Supabase SQL corpus. PR #2841 documents user_interests as insert/delete rows protected by UNIQUE(user_id, tag) and interest_vocabulary as a read-only catalogue; the following historical index migration requires user_id/tag and canonical_tag.',
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
      'The LingQ RLS review expects curated_articles and curated_dialogues created by backend/src/database/migrations/20260731000003-create-curated-content.ts, which is outside the Supabase SQL corpus. This shim mirrors that TypeORM migration exactly before its RLS policies are applied.',
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

CREATE INDEX IF NOT EXISTS idx_curated_articles_cefr_language
  ON public.curated_articles(cefr_level, language);
CREATE INDEX IF NOT EXISTS idx_curated_dialogues_cefr_language
  ON public.curated_dialogues(cefr_level, language);
`,
  },
  {
    beforeSourceFile: '20260807190000_review_rls_video_classrooms.sql',
    name: 'materialize_typeorm_quick_polls_before_rls_review',
    reason:
      'The video-classroom RLS review explicitly states that quick_polls and poll_votes were created by backend/src/database/migrations/20260730000001-create-quick-polls.ts, outside the Supabase SQL corpus. This shim mirrors that TypeORM migration exactly before its RLS policies are applied.',
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
      '20260807000000_create_escrow_transactions.sql creates escrow_transactions in the Supabase corpus without reference_id, while 20260808000001_optimise_escrow_indices.sql immediately indexes that column. Add only the missing idempotency-reference column before replaying the optimiser; the optimiser itself adds expires_at.',
    sql: `ALTER TABLE public.escrow_transactions
  ADD COLUMN IF NOT EXISTS reference_id TEXT;
`,
  },
];

const sourceIds = new Map();
const sourceEntries = files.map((file) => {
  const match = file.match(migrationPattern);
  if (!match) {
    throw new Error(
      `${file}: expected NNN_description.sql, YYYYMMDD_description.sql, or YYYYMMDDHHMMSS_description.sql`,
    );
  }

  const [, sourceId] = match;
  const sameId = sourceIds.get(sourceId) ?? [];
  sameId.push(file);
  sourceIds.set(sourceId, sameId);

  const source = readFileSync(join(sourceDirectory, file));
  const sha256 = createHash('sha256').update(source).digest('hex');

  return {
    sourceId,
    sourceFile: file,
    sha256,
    source,
  };
});

const replayEntries = [];
const shimEntries = [];
let replayOrder = 0;

const nextReplayIdentity = (suffix) => {
  replayOrder += 1;
  const replayId = String(replayOrder).padStart(14, '0');
  return {
    order: replayOrder,
    replayId,
    replayFile: `${replayId}_${suffix}.sql`,
  };
};

for (const sourceEntry of sourceEntries) {
  for (const shim of compatibilityShims.filter(
    ({ beforeSourceFile }) => beforeSourceFile === sourceEntry.sourceFile,
  )) {
    const identity = nextReplayIdentity(`compat_${shim.name}`);
    const source = Buffer.from(shim.sql, 'utf8');
    shimEntries.push({
      ...identity,
      beforeSourceFile: shim.beforeSourceFile,
      name: shim.name,
      reason: shim.reason,
      sha256: createHash('sha256').update(source).digest('hex'),
      source,
    });
  }

  replayEntries.push({
    ...nextReplayIdentity(basename(sourceEntry.sourceFile, '.sql')),
    ...sourceEntry,
  });
}

const missingShimTargets = compatibilityShims.filter(
  ({ beforeSourceFile }) => !sourceEntries.some(({ sourceFile }) => sourceFile === beforeSourceFile),
);
if (missingShimTargets.length > 0) {
  throw new Error(
    `Compatibility shim target(s) missing: ${missingShimTargets
      .map(({ beforeSourceFile }) => beforeSourceFile)
      .join(', ')}`,
  );
}

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });

const outputEntries = [...replayEntries, ...shimEntries].sort(
  (left, right) => left.order - right.order,
);
for (const entry of outputEntries) {
  writeFileSync(join(outputDirectory, entry.replayFile), entry.source);
}

const duplicates = [...sourceIds.entries()]
  .filter(([, paths]) => paths.length > 1)
  .map(([id, paths]) => ({ id, paths }));

mkdirSync(join(manifestPath, '..'), { recursive: true });
writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      sourceMigrationCount: replayEntries.length,
      replayMigrationCount: outputEntries.length,
      duplicateSourceIds: duplicates,
      compatibilityShims: shimEntries.map(({ source, ...entry }) => entry),
      migrations: replayEntries.map(({ source, ...entry }) => entry),
    },
    null,
    2,
  )}\n`,
);

console.log(
  `Prepared ${replayEntries.length} source migration(s) as ${outputEntries.length} deterministic replay step(s).`,
);
if (duplicates.length > 0) {
  console.log(`Legacy duplicate source IDs normalized for CI replay: ${duplicates.length}`);
  for (const duplicate of duplicates) {
    console.log(`- ${duplicate.id}: ${duplicate.paths.join(', ')}`);
  }
}
if (shimEntries.length > 0) {
  console.log(`Historical clean-replay compatibility shims: ${shimEntries.length}`);
  for (const shim of shimEntries) {
    console.log(`- before ${shim.beforeSourceFile}: ${shim.name}`);
  }
}
