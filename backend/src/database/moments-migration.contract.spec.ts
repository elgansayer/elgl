import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSeedMomentGraph } from './data/moments';

const repositoryRoot = resolve(process.cwd(), '..');
const read = (relativePath: string): string =>
  readFileSync(resolve(repositoryRoot, relativePath), 'utf8');

const migration = read('supabase/migrations/005_moments.sql');
const commentRepliesMigration = read(
  'supabase/migrations/012_comment_replies.sql',
);
const forYouIndexes = read(
  'supabase/migrations/20260925090000_moments_for_you_indexes.sql',
);
const feedIndexes = read(
  'supabase/migrations/20261102090000_moments_feed_indexes.sql',
);
const convergedVotes = read(
  'supabase/migrations/20260817052000_converge_moment_comment_votes.sql',
);
const rowLevelSecurity = read('supabase/migrations/009_row_level_security.sql');
const schemaDoc = read('docs/moments-schema.md');
const spec = read('SPEC.md');
const seedSource = read('backend/src/database/seed.ts');
const supabaseServiceSource = read('backend/src/supabase/supabase.service.ts');

/** Property names declared at the top level of `type <name> = { ... };`. */
function typeKeys(source: string, typeName: string): string[] {
  const match = source.match(
    new RegExp(`\\ntype ${typeName} = \\{\\n([\\s\\S]*?)\\n\\};`),
  );
  if (!match) {
    throw new Error(`type ${typeName} not found`);
  }
  return [...match[1].matchAll(/^ {2}(\w+)\??:/gm)].map((key) => key[1]);
}

/** Removes SQL comments so only executable text is inspected. */
function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--.*$/gm, ' ');
}

/** Executable statements with whitespace collapsed. */
function statements(sql: string): string[] {
  return stripComments(sql)
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Column name to normalised definition for one CREATE TABLE statement. */
function tableColumns(sql: string, table: string): Record<string, string> {
  const match = stripComments(sql).match(
    new RegExp(
      `CREATE TABLE IF NOT EXISTS public\\.${table} \\(\\n([\\s\\S]*?)\\n\\);`,
    ),
  );
  if (!match) {
    throw new Error(`CREATE TABLE IF NOT EXISTS public.${table} not found`);
  }

  const columns: Record<string, string> = {};
  for (const rawLine of match[1].split('\n')) {
    const line = rawLine.trim().replace(/,$/, '');
    if (
      !line ||
      /^(CONSTRAINT|PRIMARY KEY|UNIQUE|FOREIGN KEY|CHECK)\b/i.test(line)
    ) {
      continue;
    }
    const [name, ...definition] = line.split(/\s+/);
    columns[name] = definition.join(' ');
  }
  return columns;
}

/** Columns that an INSERT must supply: NOT NULL with no default. */
function requiredColumns(columns: Record<string, string>): string[] {
  return Object.entries(columns)
    .filter(
      ([, definition]) =>
        /\bNOT NULL\b/.test(definition) &&
        !/\bDEFAULT\b/.test(definition) &&
        !/\bPRIMARY KEY\b/.test(definition),
    )
    .map(([name]) => name);
}

/** Text from a heading to the next level 2 or 3 heading. */
function markdownSection(markdown: string, heading: RegExp): string {
  const start = markdown.search(heading);
  if (start === -1) {
    throw new Error(`Missing heading ${heading}`);
  }
  const rest = markdown.slice(start);
  const end = rest.slice(1).search(/\n#{2,3} /);
  return end === -1 ? rest : rest.slice(0, end + 1);
}

function indexNames(sql: string): string[] {
  return statements(sql)
    .filter((statement) => statement.startsWith('CREATE INDEX'))
    .map((statement) => {
      const name = statement.match(/CREATE INDEX IF NOT EXISTS (\w+) /)?.[1];
      if (!name) {
        throw new Error(`Unnamed index statement: ${statement}`);
      }
      return name;
    });
}

const USERS_CASCADE =
  'UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE';
const MOMENTS_CASCADE =
  'UUID NOT NULL REFERENCES public.moments(id) ON DELETE CASCADE';
const UUID_PK = 'UUID PRIMARY KEY DEFAULT uuid_generate_v4()';
const CREATED_AT = 'TIMESTAMPTZ NOT NULL DEFAULT now()';

const MOMENTS_COLUMNS = {
  id: UUID_PK,
  user_id: USERS_CASCADE,
  text_content: 'TEXT',
  media_urls: "TEXT[] DEFAULT '{}'",
  media_type: "VARCHAR(50) DEFAULT 'none'",
  target_language: "VARCHAR(50) NOT NULL DEFAULT 'en'",
  voice_note_url: 'TEXT',
  post_type: "VARCHAR(50) DEFAULT 'moment'",
  question_text: 'TEXT',
  question_options: "TEXT[] DEFAULT '{}'",
  correct_answer: 'VARCHAR(255)',
  correct_answers_count: 'INTEGER NOT NULL DEFAULT 0',
  total_answers_count: 'INTEGER NOT NULL DEFAULT 0',
  is_pinned: 'BOOLEAN NOT NULL DEFAULT false',
  likes_count: 'INTEGER NOT NULL DEFAULT 0',
  comments_count: 'INTEGER NOT NULL DEFAULT 0',
  is_ephemeral: 'BOOLEAN NOT NULL DEFAULT false',
  expires_at: 'TIMESTAMPTZ',
  created_at: CREATED_AT,
};

const MOMENT_LIKES_COLUMNS = {
  id: UUID_PK,
  moment_id: MOMENTS_CASCADE,
  user_id: USERS_CASCADE,
  created_at: CREATED_AT,
};

const MOMENT_COMMENTS_COLUMNS = {
  id: UUID_PK,
  moment_id: MOMENTS_CASCADE,
  user_id: USERS_CASCADE,
  text_content: 'TEXT',
  correction_payload: 'JSONB',
  parent_comment_id:
    'UUID REFERENCES public.moment_comments(id) ON DELETE CASCADE',
  reply_to_user_id: 'UUID REFERENCES public.users(id) ON DELETE CASCADE',
  created_at: CREATED_AT,
};

const MOMENT_MEDIA_TYPES = ['none', 'images', 'audio', 'video'];
const MOMENT_POST_TYPES = ['moment', 'question', 'language_question'];

/**
 * Columns of every table that 005_moments.sql creates, in their fully migrated
 * state. 005_moments.sql named the correction vote column `vote_type`; the
 * forward migration 20260817052000_converge_moment_comment_votes.sql renames it
 * to `vote` (asserted below), so the votes table is listed with `vote`.
 */
const MIGRATED_COLUMNS: Record<string, readonly string[]> = {
  moments: Object.keys(MOMENTS_COLUMNS),
  moment_comments: Object.keys(MOMENT_COMMENTS_COLUMNS),
  moment_likes: Object.keys(MOMENT_LIKES_COLUMNS),
  moment_comment_votes: Object.keys(
    tableColumns(migration, 'moment_comment_votes'),
  ).map((column) => (column === 'vote_type' ? 'vote' : column)),
  moment_question_answers: Object.keys(
    tableColumns(migration, 'moment_question_answers'),
  ),
  user_follows: Object.keys(tableColumns(migration, 'user_follows')),
};

describe('005_moments migration contract (#1827)', () => {
  it('creates moments with the columns, defaults and ownership the Moments API relies on', () => {
    expect(tableColumns(migration, 'moments')).toEqual(MOMENTS_COLUMNS);
  });

  it('creates moment_likes owned by a user and a moment', () => {
    expect(tableColumns(migration, 'moment_likes')).toEqual(
      MOMENT_LIKES_COLUMNS,
    );
  });

  it('creates threaded moment_comments with a JSONB correction payload', () => {
    expect(tableColumns(migration, 'moment_comments')).toEqual(
      MOMENT_COMMENTS_COLUMNS,
    );
  });

  it('creates the companion tables that belong to the same migration', () => {
    expect(tableColumns(migration, 'user_follows')).toEqual({
      follower_id: USERS_CASCADE,
      following_id: USERS_CASCADE,
      created_at: CREATED_AT,
    });
    expect(tableColumns(migration, 'moment_comment_votes')).toEqual({
      id: UUID_PK,
      comment_id:
        'UUID NOT NULL REFERENCES public.moment_comments(id) ON DELETE CASCADE',
      user_id: USERS_CASCADE,
      vote_type: "VARCHAR(10) NOT NULL CHECK (vote_type IN ('up', 'down'))",
      created_at: CREATED_AT,
    });
    expect(tableColumns(migration, 'moment_question_answers')).toEqual({
      id: UUID_PK,
      moment_id: MOMENTS_CASCADE,
      user_id: USERS_CASCADE,
      selected_answer: 'VARCHAR(255) NOT NULL',
      is_correct: 'BOOLEAN NOT NULL DEFAULT false',
      created_at: CREATED_AT,
    });
  });

  it('uses database constraints as the duplicate and concurrency boundary', () => {
    expect(migration).toMatch(
      /CONSTRAINT unique_moment_like UNIQUE \(moment_id, user_id\)/,
    );
    expect(migration).toMatch(
      /CONSTRAINT unique_moment_comment_vote UNIQUE \(comment_id, user_id\)/,
    );
    expect(migration).toMatch(
      /CONSTRAINT unique_moment_question_answer UNIQUE \(moment_id, user_id\)/,
    );
    expect(migration).toMatch(/PRIMARY KEY \(follower_id, following_id\)/);
  });

  it('cascades every ownership reference so deletions leave no orphaned rows', () => {
    const referencing = [
      ...Object.values(MOMENTS_COLUMNS),
      ...Object.values(MOMENT_LIKES_COLUMNS),
      ...Object.values(MOMENT_COMMENTS_COLUMNS),
    ].filter((definition) => definition.includes('REFERENCES'));

    expect(referencing.length).toBeGreaterThanOrEqual(6);
    for (const definition of referencing) {
      expect(definition).toMatch(/ON DELETE CASCADE$/);
    }
  });

  it('declares exactly the indexes that serve the documented query paths', () => {
    expect(
      statements(migration).filter((statement) =>
        statement.startsWith('CREATE INDEX'),
      ),
    ).toEqual([
      'CREATE INDEX IF NOT EXISTS moments_user_created_idx ON public.moments (user_id, created_at DESC)',
      'CREATE INDEX IF NOT EXISTS moments_lang_idx ON public.moments (target_language)',
      'CREATE INDEX IF NOT EXISTS moments_media_type_idx ON public.moments (media_type)',
      'CREATE INDEX IF NOT EXISTS moments_post_type_idx ON public.moments (post_type)',
      'CREATE INDEX IF NOT EXISTS moments_is_ephemeral_idx ON public.moments (is_ephemeral, expires_at)',
      'CREATE INDEX IF NOT EXISTS moment_likes_moment_user_idx ON public.moment_likes (moment_id, user_id)',
      'CREATE INDEX IF NOT EXISTS moment_comments_idx ON public.moment_comments (moment_id, created_at ASC)',
      'CREATE INDEX IF NOT EXISTS moment_comments_parent_idx ON public.moment_comments (parent_comment_id)',
      'CREATE INDEX IF NOT EXISTS user_follows_follower_idx ON public.user_follows (follower_id)',
      'CREATE INDEX IF NOT EXISTS moment_comment_votes_comment_idx ON public.moment_comment_votes (comment_id, vote_type)',
      'CREATE INDEX IF NOT EXISTS moment_question_answers_moment_idx ON public.moment_question_answers (moment_id)',
      'CREATE INDEX IF NOT EXISTS moment_question_answers_user_idx ON public.moment_question_answers (user_id)',
    ]);
  });

  it('is safe to replay: only idempotent creates, no destructive statements', () => {
    const executable = statements(migration);

    expect(executable.length).toBeGreaterThan(0);
    for (const statement of executable) {
      expect(statement).toMatch(/^CREATE (?:TABLE|INDEX) IF NOT EXISTS /);
    }
    // `ON DELETE CASCADE` is a referential action, not a destructive statement.
    expect(executable.join(' ')).not.toMatch(
      /\b(?:DROP|TRUNCATE|ALTER|INSERT)\b|(?<!ON )\b(?:DELETE|UPDATE)\b/i,
    );
  });
});

describe('forward migrations that extend the moments schema (#1827)', () => {
  it('re-declares threaded comment columns identically so replays converge', () => {
    expect(commentRepliesMigration).toMatch(
      /ADD COLUMN IF NOT EXISTS parent_comment_id UUID NULL REFERENCES public\.moment_comments\(id\) ON DELETE CASCADE/,
    );
    expect(commentRepliesMigration).toMatch(
      /ADD COLUMN IF NOT EXISTS reply_to_user_id UUID NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/,
    );
    expect(commentRepliesMigration).toMatch(
      /CREATE INDEX IF NOT EXISTS moment_comments_parent_idx/,
    );
  });

  it('adds only additive indexes for the For You, feed and account lifecycle read paths', () => {
    expect(indexNames(forYouIndexes)).toEqual([
      'moments_created_at_idx',
      'moment_likes_user_created_idx',
    ]);
    expect(indexNames(feedIndexes)).toEqual([
      'moments_pinned_created_idx',
      'moments_lang_pinned_created_idx',
      'user_follows_following_idx',
      'moment_comments_user_created_idx',
      'moment_comments_reply_to_user_idx',
      'moment_comment_votes_user_idx',
    ]);
  });

  it('renames the correction vote column that 005_moments.sql called vote_type', () => {
    expect(convergedVotes).toMatch(/RENAME COLUMN vote_type TO vote/);
    expect(convergedVotes).toMatch(
      /RENAME CONSTRAINT unique_moment_comment_vote TO unique_comment_vote/,
    );
  });
});

describe('row-level security for the moments tables (#1827)', () => {
  const policies = (table: string): string[] =>
    [
      ...rowLevelSecurity.matchAll(
        new RegExp(
          `CREATE POLICY (\\w+) ON public\\.${table}\\s+FOR (\\w+) TO (\\w+)`,
          'g',
        ),
      ),
    ].map((match) => `${match[2]} TO ${match[3]}`);

  it('enables RLS on every table created for the feature', () => {
    for (const table of ['moments', 'moment_likes', 'moment_comments']) {
      expect(rowLevelSecurity).toContain(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`,
      );
    }
  });

  it('allows owners to mutate their Moments and nothing else', () => {
    expect(policies('moments')).toEqual([
      'SELECT TO authenticated',
      'INSERT TO authenticated',
      'UPDATE TO authenticated',
      'DELETE TO authenticated',
    ]);
  });

  it('keeps likes and comments immutable for direct clients: insert and delete own rows only', () => {
    expect(policies('moment_likes')).toEqual([
      'SELECT TO authenticated',
      'INSERT TO authenticated',
      'DELETE TO authenticated',
    ]);
    expect(policies('moment_comments')).toEqual([
      'SELECT TO authenticated',
      'INSERT TO authenticated',
      'DELETE TO authenticated',
    ]);
  });

  it('grants no anonymous access to Moments data', () => {
    expect(rowLevelSecurity).not.toMatch(
      /ON public\.moment(?:s|_likes|_comments)\s+FOR \w+ TO anon/,
    );
  });
});

describe('typed Supabase client rows match the migrated schema (#1827)', () => {
  // The typed client map is hand-written, so a stale property type lets code
  // write a column that does not exist without a compile error. The retired
  // names below stay declared only because the unreachable legacy
  // src/feed/feed.service.ts still compiles against them (see the production
  // query conformance suite). Remove an alias together with that file; never
  // add one.
  const typeNames = [
    'MomentRow',
    'MomentCommentRow',
    'MomentLikeRow',
    'MomentCommentVotesRow',
    'MomentQuestionAnswersRow',
    'UserFollowRow',
  ] as const;
  const deprecatedAliases: Record<(typeof typeNames)[number], string[]> = {
    MomentRow: ['author_id', 'content_text', 'detected_language'],
    MomentCommentRow: ['author_id'],
    MomentLikeRow: [],
    MomentCommentVotesRow: [],
    MomentQuestionAnswersRow: [],
    UserFollowRow: [],
  };
  const migrated: Record<(typeof typeNames)[number], string[]> = {
    MomentRow: Object.keys(MOMENTS_COLUMNS),
    MomentCommentRow: Object.keys(MOMENT_COMMENTS_COLUMNS),
    MomentLikeRow: Object.keys(MOMENT_LIKES_COLUMNS),
    MomentCommentVotesRow: [...MIGRATED_COLUMNS.moment_comment_votes],
    MomentQuestionAnswersRow: [...MIGRATED_COLUMNS.moment_question_answers],
    UserFollowRow: [...MIGRATED_COLUMNS.user_follows],
  };

  it.each(typeNames)(
    '%s only declares migrated columns plus its documented legacy aliases',
    (typeName) => {
      const unknown = typeKeys(supabaseServiceSource, typeName).filter(
        (key) =>
          !migrated[typeName].includes(key) &&
          !deprecatedAliases[typeName].includes(key),
      );

      expect(unknown).toEqual([]);
    },
  );

  it('labels every retired alias @deprecated so nobody mistakes it for a column', () => {
    for (const [typeName, aliases] of Object.entries(deprecatedAliases)) {
      for (const alias of aliases) {
        const block = supabaseServiceSource.slice(
          supabaseServiceSource.indexOf(`\ntype ${typeName} = {`),
        );
        expect(block, `${typeName}.${alias}`).toMatch(
          new RegExp(`/\\*\\* @deprecated [^\\n]*\\*/\\n {2}${alias}\\?:`),
        );
      }
    }
  });

  it('does not give user_follows a surrogate id: its key is (follower_id, following_id)', () => {
    expect(typeKeys(supabaseServiceSource, 'UserFollowRow')).not.toContain(
      'id',
    );
  });

  it('records the question answer in selected_answer, never the retired answer column', () => {
    const keys = typeKeys(supabaseServiceSource, 'MomentQuestionAnswersRow');

    expect(keys).toContain('selected_answer');
    expect(keys).not.toContain('answer');
  });
});

describe('seed data conforms to the migrated schema (#1827)', () => {
  const host = '11111111-1111-4111-8111-111111111111';
  const partner = '22222222-2222-4222-8222-222222222222';
  const likerA = '33333333-3333-4333-8333-333333333333';
  const likerB = '44444444-4444-4444-8444-444444444444';
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  const build = () =>
    buildSeedMomentGraph({
      hostId: host,
      partnerId: partner,
      likerIds: [host, partner, likerA, likerA, likerB],
    });

  it('only writes columns that exist and supplies every required column', () => {
    const graph = build();
    const momentColumns = Object.keys(MOMENTS_COLUMNS);
    const commentColumns = Object.keys(MOMENT_COMMENTS_COLUMNS);
    const likeColumns = Object.keys(MOMENT_LIKES_COLUMNS);

    expect(momentColumns).toEqual(
      expect.arrayContaining(Object.keys(graph.moment)),
    );
    expect(Object.keys(graph.moment)).toEqual(
      expect.arrayContaining(requiredColumns(MOMENTS_COLUMNS)),
    );

    for (const comment of graph.comments) {
      expect(commentColumns).toEqual(
        expect.arrayContaining(Object.keys(comment)),
      );
      expect(Object.keys(comment)).toEqual(
        expect.arrayContaining(requiredColumns(MOMENT_COMMENTS_COLUMNS)),
      );
    }

    for (const like of graph.likes) {
      expect(likeColumns).toEqual(expect.arrayContaining(Object.keys(like)));
      expect(Object.keys(like)).toEqual(
        expect.arrayContaining(requiredColumns(MOMENT_LIKES_COLUMNS)),
      );
    }
  });

  it('uses the enumerations and bounds the Moments API enforces', () => {
    const { moment, comments } = build();

    expect(MOMENT_MEDIA_TYPES).toContain(moment.media_type);
    expect(MOMENT_POST_TYPES).toContain(moment.post_type);
    expect(moment.target_language).toMatch(/^[a-z]{2,3}$/);
    expect(moment.media_urls.length).toBeLessThanOrEqual(9);
    expect(moment.text_content.length).toBeLessThanOrEqual(5000);
    for (const comment of comments) {
      expect(comment.text_content.length).toBeLessThanOrEqual(2000);
    }
  });

  it('keeps denormalised counters in agreement with the child rows', () => {
    const graph = build();

    expect(graph.moment.likes_count).toBe(graph.likes.length);
    expect(graph.moment.comments_count).toBe(graph.comments.length);
  });

  it('never lets the author like their own Moment and collapses duplicate likers', () => {
    const { likes } = build();

    expect(likes.map((like) => like.user_id).sort()).toEqual(
      [partner, likerA, likerB].sort(),
    );
    expect(new Set(likes.map((like) => like.user_id)).size).toBe(likes.length);
  });

  it('builds a valid comment thread: parents first, replies point back at their author', () => {
    const { moment, comments } = build();
    const seen = new Map<string, string>();

    for (const comment of comments) {
      expect(comment.id).toMatch(uuid);
      expect(comment.moment_id).toBe(moment.id);
      if (comment.parent_comment_id) {
        expect(seen.has(comment.parent_comment_id)).toBe(true);
        expect(comment.reply_to_user_id).toBe(
          seen.get(comment.parent_comment_id),
        );
      } else {
        expect(comment.reply_to_user_id).toBeNull();
      }
      seen.set(comment.id, comment.user_id);
    }
    expect(comments.some((comment) => comment.parent_comment_id)).toBe(true);
  });

  it('seeds a correction in the payload shape the Moments API stores', () => {
    const corrections = build().comments.filter(
      (comment) => comment.correction_payload,
    );

    expect(corrections.length).toBeGreaterThan(0);
    for (const comment of corrections) {
      expect(Object.keys(comment.correction_payload ?? {}).sort()).toEqual([
        'corrected',
        'explanation',
        'original',
      ]);
    }
  });

  it('generates fresh identifiers so re-seeding cannot collide on primary keys', () => {
    const first = build();
    const second = build();

    expect(first.moment.id).toMatch(uuid);
    expect(first.moment.id).not.toBe(second.moment.id);
    expect(first.comments[0].id).not.toBe(second.comments[0].id);
  });

  it('is wired into the seed script instead of inlining stale column names', () => {
    expect(seedSource).toContain("from './data/moments'");
    expect(seedSource).toContain('buildSeedMomentGraph(');
    expect(seedSource).toContain(".from('moments')");
    expect(seedSource).toContain(".from('moment_comments')");
    expect(seedSource).toContain(".from('moment_likes')");
    expect(seedSource).not.toMatch(/author_id:\s*(?:host|partner)\.id/);
    expect(seedSource).not.toContain('detected_language');
  });
});

/**
 * Static conformance of the backend's Supabase queries with the migrated schema.
 *
 * Every service mocks the Supabase client and answers `{ data: [], error: null }`
 * whatever column it is asked about, so unit tests cannot notice a query on a
 * column that does not exist. Production does notice: PostgREST answers 42703.
 * That is how the GDPR archive (which aborts on any failed dataset), account
 * erasure, statistics and moderation came to filter on `author_id`,
 * `content_text` and `detected_language`, none of which exist.
 *
 * The parser follows fluent chains that start at `.from('<moments table>')` and
 * reads string-literal columns from filters, ordering, select lists, embedded
 * relations, `or()` filters, insert/update/upsert object keys and `onConflict`.
 * Limits: a builder assigned to a variable and extended in a later statement,
 * and payloads built in a variable, are not followed. Typed rows and the seed
 * spec cover those, and the suites below prove the parser still sees the known
 * call sites.
 */
interface QueryFinding {
  file: string;
  line: number;
  table: string;
  method: string;
  column: string;
}

/** Relations that may be embedded; `alias:<other name>(...)` names an FK column. */
const EMBEDDABLE_RELATIONS = new Set([
  'users',
  'profiles',
  'moments',
  'moment_comments',
  'moment_likes',
]);
const FILTER_METHODS = new Set([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'ilike',
  'is',
  'in',
  'not',
  'order',
  'contains',
  'containedBy',
  'overlaps',
]);
const WRITE_METHODS = new Set(['insert', 'update', 'upsert']);
/** Source files that still name retired columns but cannot be reached. */
const UNREACHABLE_LEGACY_FILES = new Set(['feed/feed.service.ts']);

/** Replaces comments with spaces so apostrophes in prose cannot start a string. */
function maskComments(source: string): string {
  let output = '';
  let quote: string | null = null;
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (quote) {
      output += char;
      if (char === '\\' && next !== undefined) {
        output += next;
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
      index += 1;
    } else if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') {
        output += ' ';
        index += 1;
      }
    } else if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      const stop = end === -1 ? source.length : end + 2;
      output += source.slice(index, stop).replace(/[^\n]/g, ' ');
      index = stop;
    } else {
      if (char === "'" || char === '"' || char === '`') {
        quote = char;
      }
      output += char;
      index += 1;
    }
  }
  return output;
}

/** Text inside the bracket that opens at `open`, skipping string literals. */
function bracketBody(source: string, open: number): string {
  const closers: Record<string, string> = { '(': ')', '{': '}', '[': ']' };
  const opener = source[open];
  const closer = closers[opener];
  let depth = 0;
  let quote: string | null = null;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === '\\') {
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
    } else if (char === "'" || char === '"' || char === '`') {
      quote = char;
    } else if (char === opener) {
      depth += 1;
    } else if (char === closer) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(open + 1, index);
      }
    }
  }
  return source.slice(open + 1);
}

/** Splits on commas that are outside every bracket pair and string literal. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      current += char;
      if (char === '\\') {
        current += text[index + 1] ?? '';
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
    } else if (char === "'" || char === '"' || char === '`') {
      quote = char;
      current += char;
    } else if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      if ('({['.includes(char)) depth += 1;
      if (')}]'.includes(char)) depth -= 1;
      current += char;
    }
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** Property names of an object literal body: `a: 1, 'b': 2, c, ...rest`. */
function objectKeys(body: string): string[] {
  const keys: string[] = [];
  for (const entry of splitTopLevel(body)) {
    if (entry.startsWith('...')) continue;
    const key = entry.match(/^(?:'([^']+)'|"([^"]+)"|([A-Za-z_]\w*))\s*(:|$)/);
    if (key) {
      keys.push(key[1] ?? key[2] ?? key[3]);
    }
  }
  return keys;
}

/** Plain columns, plus the FK column of an `alias:fk_column(...)` embed. */
function selectColumns(list: string): string[] {
  const columns: string[] = [];
  for (const raw of splitTopLevel(list)) {
    const item = raw
      .replace(/\s+/g, ' ')
      .replace(/::\w+$/, '')
      .trim();
    const open = item.indexOf('(');
    if (open === -1) {
      const plain = item.match(/^(?:\w+:)?(\w+)$/);
      if (plain && item !== '*') columns.push(plain[1]);
      continue;
    }
    const embed = item
      .slice(0, open)
      .trim()
      .match(/^\w+:(\w+)$/);
    if (embed && !EMBEDDABLE_RELATIONS.has(embed[1])) {
      columns.push(embed[1]);
    }
  }
  return columns;
}

/** Columns named by a PostgREST `or()` expression such as `a.eq.1,b.is.null`. */
function orColumns(expression: string): string[] {
  return splitTopLevel(expression)
    .map((part) =>
      part.match(
        /^(\w+)\.(?:eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|cd|ov)\./,
      ),
    )
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => match[1]);
}

/** First string-literal argument of a call, or null when it is not a literal. */
function firstLiteral(args: string): string | null {
  return args.match(/^\s*(['"`])([\s\S]*?)\1/)?.[2] ?? null;
}

interface QueryAnalysis {
  /** Column references that were read and checked, whether valid or not. */
  references: number;
  findings: QueryFinding[];
}

function analyseQueries(file: string, source: string): QueryAnalysis {
  const masked = maskComments(source);
  const findings: QueryFinding[] = [];
  let references = 0;
  const fromCall = new RegExp(
    `\\.from\\(\\s*['"\`](${Object.keys(MIGRATED_COLUMNS).join('|')})['"\`]\\s*\\)`,
    'g',
  );
  const chainCall = /\s*\.\s*([A-Za-z]+)\s*(?:<[^>(]*>)?\s*\(/y;

  const check = (
    table: string,
    method: string,
    column: string,
    offset: number,
  ): void => {
    references += 1;
    if (!MIGRATED_COLUMNS[table].includes(column)) {
      findings.push({
        file,
        line: masked.slice(0, offset).split('\n').length,
        table,
        method,
        column,
      });
    }
  };

  for (const from of masked.matchAll(fromCall)) {
    const table = from[1];
    const start = from.index ?? 0;
    let cursor = start + from[0].length;
    for (;;) {
      chainCall.lastIndex = cursor;
      const call = chainCall.exec(masked);
      if (!call) break;
      const method = call[1];
      const open = cursor + call[0].length - 1;
      const args = bracketBody(masked, open);
      cursor = open + args.length + 2;

      if (FILTER_METHODS.has(method)) {
        const column = firstLiteral(args);
        const foreign = /referencedTable|foreignTable/.test(args);
        if (column && !column.includes('.') && !foreign) {
          check(table, method, column, start);
        }
      } else if (method === 'select') {
        const list = firstLiteral(args);
        for (const column of list ? selectColumns(list) : []) {
          check(table, method, column, start);
        }
      } else if (method === 'or') {
        for (const column of orColumns(firstLiteral(args) ?? '')) {
          check(table, method, column, start);
        }
      } else if (WRITE_METHODS.has(method)) {
        const payload = splitTopLevel(args)[0] ?? '';
        const objects = payload.startsWith('[')
          ? splitTopLevel(payload.slice(1, -1))
          : [payload];
        for (const object of objects) {
          if (object.startsWith('{')) {
            for (const key of objectKeys(object.slice(1, -1))) {
              check(table, method, key, start);
            }
          }
        }
        const conflict = args.match(/onConflict:\s*(['"`])([^'"`]+)\1/);
        for (const column of conflict?.[2].split(',') ?? []) {
          check(table, 'onConflict', column.trim(), start);
        }
      }
    }
  }

  // Deletion lists pair a table with a column and are run through a generic
  // helper, so no `.from('<table>')` chain names the column.
  for (const pair of masked.matchAll(
    /\{\s*table:\s*'(\w+)',\s*column:\s*'(\w+)'\s*\}/g,
  )) {
    if (pair[1] in MIGRATED_COLUMNS) {
      check(pair[1], 'delete', pair[2], pair.index ?? 0);
    }
  }

  return { references, findings };
}

/** Production sources under backend/src: no specs, e2e specs or typings. */
function productionSources(
  extension: '.ts' | '.sql' = '.ts',
): Array<{ file: string; source: string }> {
  const root = resolve(repositoryRoot, 'backend/src');
  const found: Array<{ file: string; source: string }> = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (
        entry.name.endsWith(extension) &&
        !/\.(?:spec|e2e-spec|d)\.ts$/.test(entry.name)
      ) {
        found.push({
          file: relative(root, path),
          source: readFileSync(path, 'utf8'),
        });
      }
    }
  };
  walk(root);
  return found;
}

const describeFinding = (finding: QueryFinding): string =>
  `${finding.file}:${finding.line} ${finding.table}.${finding.method}(${finding.column})`;

describe('production queries conform to the migrated schema (#1827)', () => {
  const sources = productionSources();
  const analyses = sources.map(({ file, source }) => ({
    file,
    ...analyseQueries(file, source),
  }));
  const findings = analyses.flatMap((analysis) => analysis.findings);

  it('names only migrated columns on the Moments tables in every reachable file', () => {
    expect(
      findings
        .filter(({ file }) => !UNREACHABLE_LEGACY_FILES.has(file))
        .map(describeFinding),
    ).toEqual([]);
  });

  it('keeps raw SQL under backend/src on the migrated Moments column names', () => {
    // A trigger or function body is not a .from() chain, and plpgsql resolves
    // column names only when it runs: a function that names a retired column is
    // accepted, then fails every statement that fires it.
    const sqlFiles = productionSources('.sql').map(({ file, source }) => ({
      file,
      sql: stripComments(source),
    }));

    // Proves the walk reaches the known draft, so an empty list cannot pass.
    expect(sqlFiles.map(({ file }) => file)).toContain(
      'leaderboard/update-correction-ratio.sql',
    );
    expect(
      sqlFiles
        .filter(({ sql }) =>
          /\b(?:moments|moment_comments|moment_likes)\b/.test(sql),
        )
        .filter(({ sql }) =>
          /\b(?:author_id|content_text|detected_language)\b/.test(sql),
        )
        .map(({ file }) => file),
    ).toEqual([]);
  });

  it('still names retired columns only in files that nothing can reach', () => {
    for (const legacy of UNREACHABLE_LEGACY_FILES) {
      // A stale allowlist entry hides future drift: fix or delete the file,
      // then remove it from the list.
      expect(
        findings.filter(({ file }) => file === legacy),
        legacy,
      ).not.toEqual([]);

      // `MomentsFeedService` is the real feed, so only the bare class name and
      // real import specifiers count; prose that mentions the path does not.
      const referencing = sources
        .filter(({ file }) => file !== legacy)
        .filter(
          ({ source }) =>
            /(?<![A-Za-z])FeedService\b/.test(maskComments(source)) ||
            /from\s+['"][^'"]*feed\/feed\.service['"]/.test(source),
        )
        .map(({ file }) => file);
      expect(referencing, `${legacy} must stay unreachable`).toEqual([]);
    }
  });

  it('reads columns from the known Moments call sites, so the guard cannot silently become a no-op', () => {
    // Floors, not exact counts: they sit well below today's figures so a normal
    // refactor passes, but a parser that stops following chains fails.
    const expectedFloor: Record<string, number> = {
      'moments/moments.service.ts': 100,
      'moments/moments-feed.service.ts': 1,
      'moments/moments-ranking.service.ts': 4,
      'moments/moment-likes.service.ts': 3,
      'moments/timeline.worker.ts': 2,
      'moments/correction-quality.service.ts': 3,
      'privacy/privacy.service.ts': 6,
      'privacy/data-retention.service.ts': 7,
      'users/data-export.worker.ts': 3,
      'user-statistics/user-statistics.service.ts': 6,
      'users/users.service.ts': 14,
      'moderation/moderation.service.ts': 5,
      'stats/stats.service.ts': 3,
    };
    for (const [file, floor] of Object.entries(expectedFloor)) {
      const analysis = analyses.find((entry) => entry.file === file);
      expect(analysis, `${file} is missing`).toBeDefined();
      expect(analysis?.references, file).toBeGreaterThanOrEqual(floor);
    }
  });

  it('detects retired columns in every query position', () => {
    const sample = `
      const feed = await supabase
        .from('moments')
        // the author's posts: an apostrophe in prose must not start a string
        .select('id, content_text, author:author_id ( display_name ), poster:users!moments_user_id_fkey ( display_name )')
        .eq('author_id', userId)
        .order('created_at', { ascending: false });
      await supabase.from('moment_comments').insert({ moment_id: id, author_id: userId, text_content: 'x' });
      await supabase.from('moment_likes').upsert({ moment_id: id, user_id: userId }, { onConflict: 'moment_id,liker_id' });
      await supabase.from('moments').update({ detected_language: 'en', likes_count: 1 }).or('author_id.eq.1,user_id.eq.2');
      await supabase.from('audio_room_notes').delete().eq('author_id', userId);
      const tasks = [{ table: 'moment_comments', column: 'author_id' }];
    `;

    expect(
      analyseQueries('sample.ts', sample)
        .findings.map(
          ({ table, method, column }) => `${table}.${method}(${column})`,
        )
        .sort(),
    ).toEqual(
      [
        'moments.select(content_text)',
        'moments.select(author_id)',
        'moments.eq(author_id)',
        'moment_comments.insert(author_id)',
        'moment_likes.onConflict(liker_id)',
        'moments.update(detected_language)',
        'moments.or(author_id)',
        'moment_comments.delete(author_id)',
      ].sort(),
    );
  });

  it('accepts every migrated column in the same query positions', () => {
    const sample = `
      await supabase
        .from('moments')
        .select('id, text_content, author:users!moments_user_id_fkey ( display_name )')
        .eq('user_id', userId)
        .order('is_pinned', { ascending: false });
      await supabase.from('moment_question_answers').insert({ moment_id: id, user_id: userId, selected_answer: 'A', is_correct: true });
      await supabase.from('moment_comment_votes').delete().eq('user_id', userId);
      await supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('following_id', userId);
    `;

    const { findings: sampleFindings, references } = analyseQueries(
      'sample.ts',
      sample,
    );
    expect(sampleFindings).toEqual([]);
    // Proves the clean verdict comes from reading columns, not from skipping.
    expect(references).toBeGreaterThanOrEqual(10);
  });
});

describe('schema documentation matches the migrated schema (#1827)', () => {
  const documented: Array<[string, Record<string, string>, RegExp, RegExp]> = [
    [
      'moments',
      MOMENTS_COLUMNS,
      /### `public\.moments`/,
      /### Table: `moments`/,
    ],
    [
      'moment_comments',
      MOMENT_COMMENTS_COLUMNS,
      /### `public\.moment_comments`/,
      /### Table: `moment_comments`/,
    ],
    [
      'moment_likes',
      MOMENT_LIKES_COLUMNS,
      /### `public\.moment_likes`/,
      /### Table: `moment_likes`/,
    ],
  ];

  it.each(documented)(
    'docs/moments-schema.md documents every %s column',
    (_table, columns, docHeading) => {
      const section = markdownSection(schemaDoc, docHeading);

      for (const column of Object.keys(columns)) {
        expect(section).toContain(`\`${column}\``);
      }
    },
  );

  it.each(documented)(
    'SPEC.md lists every %s column and none of the retired names',
    (_table, columns, _docHeading, specHeading) => {
      const section = markdownSection(spec, specHeading);

      for (const column of Object.keys(columns)) {
        expect(section).toContain(`- \`${column}\``);
      }
      expect(section).not.toMatch(
        /\b(?:author_id|content_text|detected_language)\b/,
      );
    },
  );

  it('SPEC.md documents the companion tables created by the same migration', () => {
    for (const table of [
      'user_follows',
      'moment_comment_votes',
      'moment_question_answers',
    ]) {
      expect(spec).toContain(`### Table: \`${table}\``);
    }
  });

  it('names every index that serves a Moments query', () => {
    for (const name of [
      ...indexNames(migration),
      ...indexNames(forYouIndexes),
      ...indexNames(feedIndexes),
    ]) {
      expect(schemaDoc).toContain(`\`${name}\``);
    }
  });

  it('records the lifecycle, authorisation and rollback contract', () => {
    for (const heading of [
      '## Baseline data model',
      '## Query and index contract',
      '## Authorisation and privacy',
      '## Retention and deletion',
      '## Verification',
      '## Rollout and rollback',
    ]) {
      expect(schemaDoc).toContain(heading);
    }
    expect(schemaDoc).toContain('005_moments.sql');
    expect(schemaDoc).toContain('append-only');
    expect(schemaDoc).toContain('20261102090000_moments_feed_indexes.sql');
  });
});
