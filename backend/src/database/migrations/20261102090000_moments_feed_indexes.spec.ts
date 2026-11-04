import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20261102090000_moments_feed_indexes.sql',
);
const MOMENTS_MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/005_moments.sql',
);
const MOMENTS_SERVICE_PATH = resolve(
  __dirname,
  '../../moments/moments.service.ts',
);
const TIMELINE_WORKER_PATH = resolve(
  __dirname,
  '../../moments/timeline.worker.ts',
);
const PRIVACY_SERVICE_PATH = resolve(
  __dirname,
  '../../privacy/privacy.service.ts',
);
const DATA_RETENTION_PATH = resolve(
  __dirname,
  '../../privacy/data-retention.service.ts',
);
const USER_STATISTICS_PATH = resolve(
  __dirname,
  '../../user-statistics/user-statistics.service.ts',
);

function statements(sql: string): string[] {
  return sql
    .replace(/--.*$/gm, '')
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Source with every run of whitespace removed, so chains match across lines. */
function compact(source: string): string {
  return source.replace(/\s+/g, '');
}

/** Column names declared by one CREATE TABLE statement. */
function tableColumnNames(sql: string, table: string): string[] {
  const body = sql.match(
    new RegExp(
      `CREATE TABLE IF NOT EXISTS public\\.${table} \\(([\\s\\S]*?)\\n\\);`,
    ),
  )?.[1];
  if (!body) {
    throw new Error(`CREATE TABLE public.${table} not found`);
  }
  // Column lines start with a lower-case name; CONSTRAINT and PRIMARY KEY lines
  // start with an upper-case keyword.
  return body
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[0])
    .filter((word) => /^[a-z_]+$/.test(word));
}

describe('Moments feed index migration (#1827)', () => {
  let sql: string;

  beforeAll(() => {
    sql = readFileSync(MIGRATION_PATH, 'utf-8');
  });

  it('indexes pinned-first, newest-first retrieval for the default feed', () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS moments_pinned_created_idx\s+ON public\.moments \(is_pinned DESC, created_at DESC\)/,
    );
  });

  it('indexes the same ordering within one language for the Classmates feed', () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS moments_lang_pinned_created_idx\s+ON public\.moments \(target_language, is_pinned DESC, created_at DESC\)/,
    );
  });

  it('indexes follower lookups by followed author for timeline fan-out', () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS user_follows_following_idx\s+ON public\.user_follows \(following_id, follower_id\)/,
    );
  });

  it('indexes comments by owner for the archive, statistics and erasure paths', () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS moment_comments_user_created_idx\s+ON public\.moment_comments \(user_id, created_at DESC\)/,
    );
  });

  it('indexes comments addressed to a user for complete account erasure', () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS moment_comments_reply_to_user_idx\s+ON public\.moment_comments \(reply_to_user_id\)\s+WHERE reply_to_user_id IS NOT NULL/,
    );
  });

  it('indexes correction votes by owner for erasure and cascade deletes', () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS moment_comment_votes_user_idx\s+ON public\.moment_comment_votes \(user_id\)/,
    );
  });

  it('is additive and safe to retry', () => {
    const executable = statements(sql);

    expect(executable).toHaveLength(6);
    for (const statement of executable) {
      expect(statement).toMatch(/^CREATE INDEX IF NOT EXISTS /);
    }
    // Rollback guidance lives in comments only, never in executable SQL.
    expect(executable.join(' ')).not.toMatch(
      /\b(?:ALTER|DROP|DELETE|UPDATE|TRUNCATE)\b/i,
    );
  });

  it('documents the query patterns and the rollback', () => {
    expect(sql).toMatch(/ORDER BY is_pinned DESC, created_at DESC LIMIT 50/);
    expect(sql).toMatch(/WHERE target_language = \$1/);
    expect(sql).toMatch(
      /WHERE following_id = \$1 AND follower_id > \$2\s+--\s+ORDER BY follower_id LIMIT \$3/,
    );
    expect(sql).toMatch(
      /WHERE user_id = \$1 ORDER BY created_at DESC LIMIT 500/,
    );
    expect(sql).toMatch(
      /DELETE FROM public\.moment_comments WHERE user_id = \$1/,
    );
    expect(sql).toMatch(
      /DELETE FROM public\.moment_comments WHERE reply_to_user_id = \$1/,
    );
    expect(sql).toMatch(
      /DELETE FROM public\.moment_comment_votes WHERE user_id = \$1/,
    );
    expect(sql).toMatch(
      /Rollback: DROP INDEX IF EXISTS public\.moments_pinned_created_idx/,
    );
    for (const index of [
      'moments_lang_pinned_created_idx',
      'user_follows_following_idx',
      'moment_comments_user_created_idx',
      'moment_comments_reply_to_user_idx',
      'moment_comment_votes_user_idx',
    ]) {
      expect(sql).toContain(`DROP INDEX IF EXISTS public.${index}`);
    }
  });

  it('only indexes columns that 005_moments.sql creates on the same table', () => {
    const moments = readFileSync(MOMENTS_MIGRATION_PATH, 'utf-8');
    const indexes = statements(sql).map((statement) => {
      const match = statement.match(
        /^CREATE INDEX IF NOT EXISTS \w+ ON public\.(\w+) \(([^)]+)\)(?: WHERE .+)?$/,
      );
      if (!match) {
        throw new Error(`Unparseable index statement: ${statement}`);
      }
      return {
        table: match[1],
        columns: match[2]
          .split(',')
          .map((column) => column.trim().split(/\s+/)[0]),
      };
    });

    expect(indexes).toHaveLength(6);
    for (const { table, columns } of indexes) {
      const declared = tableColumnNames(moments, table);
      for (const column of columns) {
        expect(declared, `${table}.${column}`).toContain(column);
      }
    }
  });

  it('keeps the indexed orderings in step with the queries they serve', () => {
    const service = readFileSync(MOMENTS_SERVICE_PATH, 'utf-8');
    const worker = readFileSync(TIMELINE_WORKER_PATH, 'utf-8');

    // getFeed orders "All" and "Classmates" by pinned first, then newest first.
    expect(service).toMatch(
      /\.order\('is_pinned', \{ ascending: false \}\)\s*\.order\('created_at', \{ ascending: false \}\)/,
    );
    expect(service).toMatch(/\.eq\('target_language', lang\)/);

    // The fan-out worker pages followers of the author in follower_id order.
    expect(worker).toMatch(/\.eq\('following_id', authorId\)/);
    expect(worker).toMatch(/\.order\('follower_id', \{ ascending: true \}\)/);
    expect(worker).toMatch(/\.gt\('follower_id', afterFollowerId\)/);
  });

  it('keeps the owner indexes in step with the lifecycle queries they serve', () => {
    const archive = compact(readFileSync(PRIVACY_SERVICE_PATH, 'utf-8'));
    const retention = compact(readFileSync(DATA_RETENTION_PATH, 'utf-8'));
    const statistics = compact(readFileSync(USER_STATISTICS_PATH, 'utf-8'));

    // The archive pages a user's comments newest first by owner.
    expect(archive).toContain(
      ".from('moment_comments').select('*').eq('user_id',userId).order('created_at',{ascending:false})",
    );
    // Erasure deletes comments and votes by owner.
    expect(retention).toContain(
      ".from('moment_comments').delete().eq('user_id',userId)",
    );
    expect(retention).toContain(
      ".from('moment_comments').delete().eq('reply_to_user_id',userId)",
    );
    expect(retention).toContain(
      ".from('moment_comment_votes').delete().eq('user_id',userId)",
    );
    // Statistics counts a user's comments by owner within a created_at range.
    expect(statistics).toContain(
      ".from('moment_comments').select('id',{count:'exact',head:true}).eq('user_id',userId)",
    );
  });

  it('does not touch existing indexes or row-level security', () => {
    // Comments may name moments_lang_idx to explain why it is kept; only the
    // executable statements are checked.
    const executable = statements(sql).join(' ');

    expect(executable).not.toMatch(
      /moments_lang_idx|moments_user_created_idx|user_follows_follower_idx/,
    );
    expect(executable).not.toMatch(/ROW LEVEL SECURITY|CREATE POLICY/i);
  });
});
