import { RecommendationsService } from './recommendations.service';
import type { RecommendedUserDto } from './recommendations.service';

type Row = Record<string, unknown>;
type QueryResult = {
  data: Row[] | null;
  error: { code?: string; message: string } | null;
};

interface QueryState {
  relation: string;
  select: string;
  match?: Record<string, unknown>;
  is: Array<[string, unknown]>;
  not: Array<[string, string, unknown]>;
  gt: Array<[string, unknown]>;
  overlaps: Array<[string, string[]]>;
  orders: Array<[string, { ascending: boolean }]>;
  limit?: number;
}

const LOCK_KEY = 'jobs:recommendations:daily:lock';
const LAST_COMPLETED_KEY = 'jobs:recommendations:daily:last-completed';
const PRIVACY_FILTERS = {
  is_deleted: false,
  privacy_hide_from_search: false,
  is_deletion_pending: false,
};

const pairKey = (native: string, target: string) => `${native}->${target}`;

/**
 * In-memory stand-in for the PostgREST `users` table. It interprets the query
 * builder calls the service makes, so the tests do not depend on call order:
 * a query without `overlaps` is the keyset learner scan, anything else is the
 * per-language-pair candidate lookup.
 */
class FakeUsersTable {
  learners: Row[] = [];
  /** PostgREST `max_rows`: the server truncates every response to this. */
  maxRows = Number.POSITIVE_INFINITY;
  /** Models a server that ignores the keyset cursor and repeats page one. */
  ignoreCursor = false;
  readonly failingPairs = new Set<string>();
  readonly failingPages = new Set<number>();
  readonly queries: QueryState[] = [];
  onLearnerPage?: (page: number) => void;
  private readonly partners = new Map<string, Row[]>();
  private learnerPages = 0;

  setPartners(native: string, target: string, rows: Row[]): void {
    this.partners.set(pairKey(native, target), rows);
  }

  get learnerQueries(): QueryState[] {
    return this.queries.filter((query) => query.overlaps.length === 0);
  }

  get pairQueries(): QueryState[] {
    return this.queries.filter((query) => query.overlaps.length > 0);
  }

  resolve(state: QueryState): QueryResult {
    this.queries.push(state);
    return state.overlaps.length === 0
      ? this.resolveLearnerPage(state)
      : this.resolvePairQuery(state);
  }

  private resolveLearnerPage(state: QueryState): QueryResult {
    const page = ++this.learnerPages;
    this.onLearnerPage?.(page);
    if (this.failingPages.has(page)) {
      return {
        data: null,
        error: {
          code: '57014',
          message: 'statement timeout for user row 1234',
        },
      };
    }

    const cursor = this.ignoreCursor
      ? undefined
      : state.gt.find(([column]) => column === 'id')?.[1];
    const after = typeof cursor === 'string' ? cursor : undefined;
    const visible = this.learners
      .filter((row) => after === undefined || String(row['id']) > after)
      .sort((left, right) => {
        const leftId = String(left['id']);
        const rightId = String(right['id']);
        return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
      });
    return {
      data: visible.slice(0, Math.min(state.limit ?? Infinity, this.maxRows)),
      error: null,
    };
  }

  private resolvePairQuery(state: QueryState): QueryResult {
    const nativeLanguages = state.overlaps.find(
      ([column]) => column === 'native_languages',
    )?.[1];
    const targetLanguages = state.overlaps.find(
      ([column]) => column === 'target_languages',
    )?.[1];
    // The service asks for partners whose native language is the learner's
    // target and whose target language is the learner's native language.
    const key = pairKey(targetLanguages?.[0] ?? '', nativeLanguages?.[0] ?? '');

    if (this.failingPairs.has(key)) {
      return {
        data: null,
        error: {
          code: 'PGRST301',
          message: `pair ${key} timed out for user abc`,
        },
      };
    }
    return {
      data: (this.partners.get(key) ?? []).slice(0, state.limit),
      error: null,
    };
  }
}

function usersBuilder(table: FakeUsersTable, relation: string) {
  const state: QueryState = {
    relation,
    select: '',
    is: [],
    not: [],
    gt: [],
    overlaps: [],
    orders: [],
  };
  const builder = {
    select: (columns: string) => {
      state.select = columns;
      return builder;
    },
    match: (filters: Record<string, unknown>) => {
      state.match = filters;
      return builder;
    },
    is: (column: string, value: unknown) => {
      state.is.push([column, value]);
      return builder;
    },
    not: (column: string, operator: string, value: unknown) => {
      state.not.push([column, operator, value]);
      return builder;
    },
    gt: (column: string, value: unknown) => {
      state.gt.push([column, value]);
      return builder;
    },
    overlaps: (column: string, value: string[]) => {
      state.overlaps.push([column, value]);
      return builder;
    },
    order: (column: string, options: { ascending: boolean }) => {
      state.orders.push([column, options]);
      return builder;
    },
    limit: (count: number) => {
      state.limit = count;
      return builder;
    },
    then: (
      onFulfilled: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(table.resolve(state)).then(onFulfilled, onRejected),
  };
  return builder;
}

/** Redis model covering the commands the job uses: SET NX EX, EVAL and pipelines. */
class FakeRedis {
  readonly store = new Map<string, string>();
  readonly ttls = new Map<string, number>();
  readonly pipelineBatches: number[] = [];
  execAttempts = 0;
  /** SET on this key rejects, as if Redis dropped the connection mid-run. */
  failSetFor?: string;
  failNextExec?: Error;
  commandErrorOnNextExec?: Error;

  /** SET with optional EX and NX, as used by both the lock and the timestamp. */
  readonly set = vi.fn(
    (key: string, value: string, _expiry?: 'EX', ttl?: number, mode?: 'NX') => {
      if (key === this.failSetFor) {
        return Promise.reject(new Error('Connection is closed.'));
      }
      if (mode === 'NX' && this.store.has(key)) return Promise.resolve(null);
      this.store.set(key, value);
      if (ttl !== undefined) this.ttls.set(key, ttl);
      return Promise.resolve('OK');
    },
  );

  readonly eval = vi.fn(
    (_script: string, _keys: number, key: string, token: string) => {
      if (this.store.get(key) !== token) return Promise.resolve(0);
      this.store.delete(key);
      return Promise.resolve(1);
    },
  );

  readonly pipeline = vi.fn(() => {
    const commands: Array<['set', string, string, number] | ['del', string]> =
      [];
    const pipeline = {
      set: vi.fn((key: string, value: string, _expiry: 'EX', ttl: number) => {
        commands.push(['set', key, value, ttl]);
        return pipeline;
      }),
      del: vi.fn((key: string) => {
        commands.push(['del', key]);
        return pipeline;
      }),
      exec: vi.fn(() => {
        this.execAttempts++;
        if (this.failNextExec) {
          const error = this.failNextExec;
          this.failNextExec = undefined;
          return Promise.reject(error);
        }
        this.pipelineBatches.push(commands.length);
        if (this.commandErrorOnNextExec) {
          const error = this.commandErrorOnNextExec;
          this.commandErrorOnNextExec = undefined;
          return Promise.resolve(
            commands.map((_command, index) => [
              index === 0 ? error : null,
              'OK',
            ]),
          );
        }
        for (const command of commands) {
          if (command[0] === 'del') {
            this.store.delete(command[1]);
            this.ttls.delete(command[1]);
          } else {
            const [, key, value, ttl] = command;
            this.store.set(key, value);
            this.ttls.set(key, ttl);
          }
        }
        return Promise.resolve(commands.map(() => [null, 'OK']));
      }),
    };
    return pipeline;
  });

  cached(userId: string): RecommendedUserDto[] {
    const raw = this.store.get(`recommendations:daily:${userId}`);
    return raw === undefined ? [] : (JSON.parse(raw) as RecommendedUserDto[]);
  }

  cachedKeys(): string[] {
    return [...this.store.keys()].filter((key) =>
      key.startsWith('recommendations:daily:'),
    );
  }
}

function createHarness(shared?: { table: FakeUsersTable; redis: FakeRedis }) {
  const table = shared?.table ?? new FakeUsersTable();
  const redis = shared?.redis ?? new FakeRedis();
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  const metrics = { recordMatchmakingDailyJobRun: vi.fn() };
  const crashReports = { reportCrash: vi.fn().mockResolvedValue({}) };
  const service = new RecommendationsService(
    logger as never,
    {
      getClient: () => ({
        from: (relation: string) => usersBuilder(table, relation),
      }),
      getRedisClient: () => redis,
    } as never,
    { getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]) } as never,
    metrics as never,
    { isAvailable: vi.fn().mockReturnValue(true) } as never,
    crashReports as never,
  );
  return { service, table, redis, logger, metrics, crashReports };
}

const learner = (id: string, native = 'en', target = 'es'): Row => ({
  id,
  native_languages: [native],
  target_languages: [target],
});

const partner = (id: string, overrides: Row = {}): Row => ({
  id,
  display_name: `Partner ${id}`,
  avatar_url: null,
  native_languages: ['es'],
  target_languages: ['en'],
  is_serious_learner: false,
  study_streak_days: 3,
  correction_ratio: 0.5,
  last_active_at: null,
  ...overrides,
});

const partners = (count: number, prefix = 'partner'): Row[] =>
  Array.from({ length: count }, (_, index) =>
    partner(`${prefix}-${String(index + 1).padStart(2, '0')}`, {
      study_streak_days: 100 - index,
    }),
  );

const learnerId = (index: number) =>
  `learner-${String(index).padStart(5, '0')}`;

const ids = (recommendations: RecommendedUserDto[]) =>
  recommendations.map((recommendation) => recommendation.id);

describe('daily top-10 partner recommendation job', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('recommendation sets', () => {
    it("caches each learner's top ten partners for 24 hours", async () => {
      const { service, table, redis } = createHarness();
      table.learners = [learner('learner-a')];
      table.setPartners('en', 'es', partners(11));

      await service.calculateDailyRecommendations();

      expect(redis.ttls.get('recommendations:daily:learner-a')).toBe(86400);
      expect(ids(redis.cached('learner-a'))).toEqual(
        partners(10).map((row) => row['id']),
      );
      expect(redis.cached('learner-a')[0]).toEqual({
        id: 'partner-01',
        displayName: 'Partner partner-01',
        avatarUrl: null,
        nativeLanguage: 'es',
        targetLanguages: ['en'],
        sharedInterests: 0,
        isSeriousLearner: false,
        studyStreakDays: 100,
        correctionRatio: 0.5,
      });
    });

    it('still returns ten partners when the learner is one of the pair candidates', async () => {
      const { service, table, redis } = createHarness();
      table.learners = [learner('learner-a'), learner('learner-b')];
      const pool = partners(10);
      pool.splice(2, 0, partner('learner-a'));
      table.setPartners('en', 'es', pool);

      await service.calculateDailyRecommendations();

      const forA = redis.cached('learner-a');
      expect(forA).toHaveLength(10);
      expect(ids(forA)).not.toContain('learner-a');
      // learner-b is not in the pool, so they keep the strongest ten of eleven.
      const forB = redis.cached('learner-b');
      expect(forB).toHaveLength(10);
      expect(ids(forB)).toContain('learner-a');
      expect(ids(forB)).not.toContain('partner-10');
    });

    it('caches nothing for a learner whose only candidate is themself', async () => {
      const { service, table, redis, metrics } = createHarness();
      table.learners = [learner('learner-a')];
      table.setPartners('en', 'es', [partner('learner-a')]);

      await service.calculateDailyRecommendations();

      expect(redis.cachedKeys()).toEqual([]);
      expect(metrics.recordMatchmakingDailyJobRun).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'success', setsCached: 0 }),
      );
    });

    it('caches nothing for a language pair without partners', async () => {
      const { service, table, redis } = createHarness();
      table.learners = [learner('learner-a', 'en', 'ja')];

      await service.calculateDailyRecommendations();

      expect(redis.cachedKeys()).toEqual([]);
    });

    it('removes a previous cache entry when no partner currently qualifies', async () => {
      const { service, table, redis } = createHarness();
      table.learners = [learner('learner-a', 'en', 'ja')];
      redis.store.set(
        'recommendations:daily:learner-a',
        JSON.stringify([{ id: 'yesterdays-partner' }]),
      );
      redis.ttls.set('recommendations:daily:learner-a', 3600);

      await service.calculateDailyRecommendations();

      expect(redis.store.has('recommendations:daily:learner-a')).toBe(false);
      expect(redis.ttls.has('recommendations:daily:learner-a')).toBe(false);
    });

    it('removes a previous cache entry when the only candidate is the learner', async () => {
      const { service, table, redis } = createHarness();
      table.learners = [learner('learner-a')];
      table.setPartners('en', 'es', [partner('learner-a')]);
      redis.store.set(
        'recommendations:daily:learner-a',
        JSON.stringify([{ id: 'yesterdays-partner' }]),
      );

      await service.calculateDailyRecommendations();

      expect(redis.store.has('recommendations:daily:learner-a')).toBe(false);
    });

    it('computes serious-learner status from streak and recent activity, not the stored flag', async () => {
      const { service, table, redis } = createHarness();
      table.learners = [learner('learner-a')];
      table.setPartners('en', 'es', [
        partner('active', {
          study_streak_days: 10,
          last_active_at: new Date().toISOString(),
        }),
        partner('lapsed', {
          study_streak_days: 30,
          last_active_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        }),
        partner('flag-only', {
          is_serious_learner: true,
          study_streak_days: 1,
        }),
      ]);

      await service.calculateDailyRecommendations();

      expect(
        Object.fromEntries(
          redis
            .cached('learner-a')
            .map((entry) => [entry.id, entry.isSeriousLearner]),
        ),
      ).toEqual({ active: true, lapsed: false, 'flag-only': false });
    });

    it('ignores malformed candidate rows instead of caching them', async () => {
      const { service, table, redis } = createHarness();
      table.learners = [learner('learner-a')];
      table.setPartners('en', 'es', [
        { id: null, display_name: 'No id' },
        'not-a-row' as unknown as Row,
        partner('valid', {
          correction_ratio: 'high',
          study_streak_days: Number.NaN,
        }),
      ]);

      await service.calculateDailyRecommendations();

      expect(redis.cached('learner-a')).toEqual([
        expect.objectContaining({
          id: 'valid',
          correctionRatio: null,
          studyStreakDays: null,
        }),
      ]);
    });

    it('skips learners without a usable primary language pair', async () => {
      const { service, table, redis } = createHarness();
      table.learners = [
        { id: 'no-native', native_languages: [], target_languages: ['es'] },
        { id: 'no-target', native_languages: ['en'], target_languages: [] },
        { id: 'null-native', native_languages: null, target_languages: ['es'] },
        learner('learner-a'),
      ];
      table.setPartners('en', 'es', partners(2));

      await service.calculateDailyRecommendations();

      expect(redis.cachedKeys()).toEqual(['recommendations:daily:learner-a']);
    });
  });

  describe('queries', () => {
    it('applies the privacy and deletion boundary to the scan and every candidate lookup', async () => {
      const { service, table } = createHarness();
      table.learners = [learner('learner-a')];
      table.setPartners('en', 'es', partners(2));

      await service.calculateDailyRecommendations();

      expect(table.queries.length).toBeGreaterThanOrEqual(2);
      for (const query of table.queries) {
        expect(query.relation).toBe('users');
        expect(query.match).toEqual(PRIVACY_FILTERS);
        expect(query.is).toContainEqual(['scheduled_for_deletion_at', null]);
      }
      for (const query of table.learnerQueries) {
        expect(query.not).toEqual([['target_languages', 'is', null]]);
      }
    });

    it('reads learners in id order, a bounded page at a time', async () => {
      const { service, table } = createHarness();
      table.learners = [learner('learner-a')];

      await service.calculateDailyRecommendations();

      const [first] = table.learnerQueries;
      expect(first.limit).toBe(1000);
      expect(first.orders).toEqual([['id', { ascending: true }]]);
      expect(first.gt).toEqual([]);
    });

    it('fetches one spare candidate and orders by streak with id as a stable tie-break', async () => {
      const { service, table } = createHarness();
      table.learners = [learner('learner-a')];
      table.setPartners('en', 'es', partners(3));

      await service.calculateDailyRecommendations();

      expect(table.pairQueries).toHaveLength(1);
      const [query] = table.pairQueries;
      expect(query.limit).toBe(11);
      expect(query.orders).toEqual([
        ['study_streak_days', { ascending: false }],
        ['id', { ascending: true }],
      ]);
      expect(query.overlaps).toEqual([
        ['native_languages', ['es']],
        ['target_languages', ['en']],
      ]);
    });

    it('runs one candidate query for all learners sharing a language pair', async () => {
      const { service, table, redis } = createHarness();
      table.learners = Array.from({ length: 30 }, (_, index) =>
        learner(learnerId(index)),
      );
      table.setPartners('en', 'es', partners(5));

      await service.calculateDailyRecommendations();

      expect(table.pairQueries).toHaveLength(1);
      expect(redis.cachedKeys()).toHaveLength(30);
    });
  });

  describe('pagination', () => {
    it('serves every eligible learner, well past the former 5,000 learner ceiling', async () => {
      const { service, table, redis, metrics } = createHarness();
      table.learners = Array.from({ length: 5500 }, (_, index) =>
        learner(learnerId(index)),
      );
      table.setPartners('en', 'es', partners(10));

      await service.calculateDailyRecommendations();

      expect(redis.cachedKeys()).toHaveLength(5500);
      expect(table.learnerQueries).toHaveLength(7);
      expect(metrics.recordMatchmakingDailyJobRun).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'success',
          learnersScanned: 5500,
          setsCached: 5500,
          truncated: false,
        }),
      );
    });

    it('advances a keyset cursor from the last id of each page', async () => {
      const { service, table } = createHarness();
      table.maxRows = 2;
      table.learners = Array.from({ length: 5 }, (_, index) =>
        learner(learnerId(index)),
      );

      await service.calculateDailyRecommendations();

      expect(table.learnerQueries.map((query) => query.gt)).toEqual([
        [],
        [['id', learnerId(1)]],
        [['id', learnerId(3)]],
        [['id', learnerId(4)]],
      ]);
    });

    it('still reaches every learner when the server caps rows below the page size', async () => {
      const { service, table, redis } = createHarness();
      table.maxRows = 3;
      table.learners = Array.from({ length: 10 }, (_, index) =>
        learner(learnerId(index)),
      );
      table.setPartners('en', 'es', partners(2));

      await service.calculateDailyRecommendations();

      expect(redis.cachedKeys()).toHaveLength(10);
    });

    it('queries each language pair once even when it recurs on later pages', async () => {
      const { service, table } = createHarness();
      table.maxRows = 2;
      table.learners = Array.from({ length: 6 }, (_, index) =>
        learner(learnerId(index)),
      );

      await service.calculateDailyRecommendations();

      expect(table.learnerQueries.length).toBeGreaterThan(3);
      expect(table.pairQueries).toHaveLength(1);
    });

    it('writes to Redis in pipelines of at most 200 sets', async () => {
      const { service, table, redis } = createHarness();
      table.learners = Array.from({ length: 450 }, (_, index) =>
        learner(learnerId(index)),
      );
      table.setPartners('en', 'es', partners(3));

      await service.calculateDailyRecommendations();

      expect(redis.pipelineBatches).toEqual([200, 200, 50]);
    });

    it('stops at the page ceiling and reports the run as truncated', async () => {
      const { service, table, logger, metrics } = createHarness();
      table.ignoreCursor = true;
      table.learners = [learner('learner-a')];
      table.setPartners('en', 'es', partners(2));

      await service.calculateDailyRecommendations();

      expect(table.learnerQueries).toHaveLength(50);
      expect(metrics.recordMatchmakingDailyJobRun).toHaveBeenCalledWith(
        expect.objectContaining({ truncated: true }),
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ maxLearners: 50000 }),
        expect.stringContaining('stopped at its ceiling'),
      );
    });

    it('stops before its lock can expire when the runtime budget is spent', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-31T00:00:00Z'));
      const { service, table, redis, metrics } = createHarness();
      table.maxRows = 1;
      table.learners = [learner('learner-a'), learner('learner-b')];
      table.setPartners('en', 'es', partners(2));
      table.onLearnerPage = (page) => {
        if (page === 1) vi.setSystemTime(Date.now() + 46 * 60 * 1000);
      };

      await service.calculateDailyRecommendations();

      expect(table.learnerQueries).toHaveLength(1);
      expect(redis.cachedKeys()).toEqual(['recommendations:daily:learner-a']);
      expect(metrics.recordMatchmakingDailyJobRun).toHaveBeenCalledWith(
        expect.objectContaining({ truncated: true }),
      );
    });

    it('fails instead of looping when a page has rows but no usable ids', async () => {
      const { service, table, metrics, crashReports } = createHarness();
      table.learners = [{ id: 42, native_languages: ['en'] }];

      await expect(
        service.calculateDailyRecommendations(),
      ).resolves.toBeUndefined();

      expect(table.learnerQueries).toHaveLength(1);
      expect(metrics.recordMatchmakingDailyJobRun).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'failed' }),
      );
      expect(crashReports.reportCrash).toHaveBeenCalledTimes(1);
    });
  });

  describe('failure handling', () => {
    it('refreshes healthy language pairs when another pair fails', async () => {
      const { service, table, redis, logger, metrics, crashReports } =
        createHarness();
      table.learners = [
        learner('learner-es', 'en', 'es'),
        learner('learner-fr', 'en', 'fr'),
      ];
      table.setPartners('en', 'es', partners(2));
      table.failingPairs.add(pairKey('en', 'fr'));

      await expect(
        service.calculateDailyRecommendations(),
      ).resolves.toBeUndefined();

      expect(redis.cachedKeys()).toEqual(['recommendations:daily:learner-es']);
      expect(metrics.recordMatchmakingDailyJobRun).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'partial', setsCached: 1 }),
      );
      expect(crashReports.reportCrash).toHaveBeenCalledTimes(1);
      const [report] = crashReports.reportCrash.mock.calls[0];
      expect(report).toMatchObject({
        operation: 'calculateDailyRecommendations:partial',
        degraded_tier: 'language_exchange_live',
        context: expect.objectContaining({
          failedPairQueries: 1,
          pairQueries: 2,
          setsCached: 1,
        }),
      });
      expect(report.user_id).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ nativeLanguage: 'en', targetLanguage: 'fr' }),
        expect.stringContaining('candidate query failed'),
      );
    });

    it('keeps a run partial, not failed, when the healthy pairs simply have no partners', async () => {
      const { service, table, redis, metrics } = createHarness();
      table.learners = [
        learner('learner-ja', 'en', 'ja'),
        learner('learner-fr', 'en', 'fr'),
      ];
      // en->ja answers with nobody to recommend; en->fr is the one that fails.
      table.failingPairs.add(pairKey('en', 'fr'));

      await service.calculateDailyRecommendations();

      expect(redis.cachedKeys()).toEqual([]);
      expect(metrics.recordMatchmakingDailyJobRun).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'partial', setsCached: 0 }),
      );
    });

    it('fails the run, without throwing, when every candidate query fails', async () => {
      const { service, table, redis, metrics, crashReports } = createHarness();
      table.learners = [learner('learner-a')];
      table.failingPairs.add(pairKey('en', 'es'));

      await expect(
        service.calculateDailyRecommendations(),
      ).resolves.toBeUndefined();

      expect(redis.cachedKeys()).toEqual([]);
      expect(metrics.recordMatchmakingDailyJobRun).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'failed' }),
      );
      expect(crashReports.reportCrash).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'calculateDailyRecommendations',
          degraded_tier: 'none',
        }),
      );
    });

    it('reports system failures without a user id, which is a UUID foreign key', async () => {
      const { service, table, crashReports } = createHarness();
      table.learners = [learner('learner-a')];
      table.failingPairs.add(pairKey('en', 'es'));

      await service.calculateDailyRecommendations();

      const [report] = crashReports.reportCrash.mock.calls[0];
      expect(report.user_id).toBeUndefined();
      expect(report.context).toEqual(
        expect.objectContaining({ runId: expect.any(String) }),
      );
    });

    it('keeps the sets of finished pages when a later learner page fails', async () => {
      const { service, table, redis, metrics, crashReports } = createHarness();
      table.maxRows = 2;
      table.failingPages.add(2);
      table.learners = Array.from({ length: 4 }, (_, index) =>
        learner(learnerId(index)),
      );
      table.setPartners('en', 'es', partners(2));

      await expect(
        service.calculateDailyRecommendations(),
      ).resolves.toBeUndefined();

      expect(redis.cachedKeys().sort()).toEqual([
        `recommendations:daily:${learnerId(0)}`,
        `recommendations:daily:${learnerId(1)}`,
      ]);
      expect(metrics.recordMatchmakingDailyJobRun).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'failed', setsCached: 2 }),
      );
      expect(crashReports.reportCrash).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'calculateDailyRecommendations',
          context: expect.objectContaining({ pagesScanned: 1 }),
        }),
      );
    });

    it('keeps database error details out of the failure report', async () => {
      const { service, table, crashReports, logger } = createHarness();
      table.failingPages.add(1);
      table.learners = [learner('learner-a')];

      await service.calculateDailyRecommendations();

      const [report] = crashReports.reportCrash.mock.calls[0];
      expect(report.error_message).toBe('Failed to fetch learners (57014)');
      expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
        'user row 1234',
      );
    });

    it('reports a failed Redis pipeline once and never retries the write', async () => {
      const { service, table, redis, metrics, crashReports } = createHarness();
      table.learners = [learner('learner-a')];
      table.setPartners('en', 'es', partners(2));
      redis.failNextExec = new Error('Connection is closed.');

      await expect(
        service.calculateDailyRecommendations(),
      ).resolves.toBeUndefined();

      expect(redis.execAttempts).toBe(1);
      expect(redis.cachedKeys()).toEqual([]);
      expect(metrics.recordMatchmakingDailyJobRun).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'failed', setsCached: 0 }),
      );
      expect(crashReports.reportCrash).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'calculateDailyRecommendations',
          error_message: 'Connection is closed.',
        }),
      );
    });

    it('treats a Redis command error inside a pipeline as a failed run', async () => {
      const { service, table, redis, metrics } = createHarness();
      table.learners = [learner('learner-a')];
      table.setPartners('en', 'es', partners(2));
      redis.commandErrorOnNextExec = new Error('READONLY You can not write');

      await service.calculateDailyRecommendations();

      expect(metrics.recordMatchmakingDailyJobRun).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'failed', setsCached: 0 }),
      );
    });

    it('fails the run when the lock cannot be acquired because Redis is down', async () => {
      const { service, table, redis, metrics, crashReports } = createHarness();
      table.learners = [learner('learner-a')];
      redis.set.mockRejectedValueOnce(new Error('Connection is closed.'));

      await expect(
        service.calculateDailyRecommendations(),
      ).resolves.toBeUndefined();

      expect(table.queries).toHaveLength(0);
      expect(metrics.recordMatchmakingDailyJobRun).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'failed' }),
      );
      expect(crashReports.reportCrash).toHaveBeenCalledTimes(1);
    });

    it('never throws, even when crash reporting itself fails', async () => {
      const { service, table, crashReports } = createHarness();
      table.failingPages.add(1);
      table.learners = [learner('learner-a')];
      crashReports.reportCrash.mockRejectedValue(
        new Error('crash table offline'),
      );

      await expect(
        service.calculateDailyRecommendations(),
      ).resolves.toBeUndefined();
    });
  });

  describe('single-flight execution', () => {
    it('takes a time-limited lock outside the recommendation cache namespace', async () => {
      const { service, table, redis } = createHarness();
      table.learners = [learner('learner-a')];

      await service.calculateDailyRecommendations();

      expect(redis.set).toHaveBeenCalledWith(
        LOCK_KEY,
        expect.any(String),
        'EX',
        3600,
        'NX',
      );
      // The invalidation sweeps and the metrics SCAN match this prefix.
      expect(LOCK_KEY.startsWith('recommendations:daily:')).toBe(false);
    });

    it('skips the run when another replica already holds the lock', async () => {
      const { service, table, redis, metrics, crashReports, logger } =
        createHarness();
      table.learners = [learner('learner-a')];
      redis.store.set(LOCK_KEY, 'other-replica');

      await service.calculateDailyRecommendations();

      expect(table.queries).toHaveLength(0);
      expect(redis.cachedKeys()).toEqual([]);
      expect(redis.store.get(LOCK_KEY)).toBe('other-replica');
      expect(crashReports.reportCrash).not.toHaveBeenCalled();
      expect(metrics.recordMatchmakingDailyJobRun).toHaveBeenCalledWith({
        outcome: 'skipped',
        durationSeconds: expect.any(Number),
        learnersScanned: 0,
        setsCached: 0,
        truncated: false,
      });
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'skipped' }),
        expect.stringContaining('already running on another instance'),
      );
    });

    it('lets exactly one of several replicas sharing Redis do the work', async () => {
      const table = new FakeUsersTable();
      const redis = new FakeRedis();
      table.learners = [learner('learner-a')];
      table.setPartners('en', 'es', partners(3));
      const replicas = [1, 2, 3].map(() => createHarness({ table, redis }));

      await Promise.all(
        replicas.map((replica) =>
          replica.service.calculateDailyRecommendations(),
        ),
      );

      const outcomes = replicas
        .map(
          (replica) =>
            replica.metrics.recordMatchmakingDailyJobRun.mock.calls[0][0]
              .outcome as string,
        )
        .sort();
      expect(outcomes).toEqual(['skipped', 'skipped', 'success']);
      expect(table.learnerQueries).toHaveLength(2);
      expect(redis.pipelineBatches).toEqual([1]);
    });

    it.each([
      ['succeeds', undefined],
      ['fails', new Error('Connection is closed.')],
    ])(
      'releases the lock when the run %s so the next run can start',
      async (_label, execError) => {
        const { service, table, redis, metrics } = createHarness();
        table.learners = [learner('learner-a')];
        table.setPartners('en', 'es', partners(2));
        redis.failNextExec = execError;

        await service.calculateDailyRecommendations();
        expect(redis.store.has(LOCK_KEY)).toBe(false);

        await service.calculateDailyRecommendations();
        expect(metrics.recordMatchmakingDailyJobRun).toHaveBeenLastCalledWith(
          expect.objectContaining({ outcome: 'success' }),
        );
      },
    );

    it('warns, but still finishes, when the lock expired before release', async () => {
      const { service, table, redis, logger, metrics } = createHarness();
      table.learners = [learner('learner-a')];
      table.setPartners('en', 'es', partners(2));
      redis.eval.mockResolvedValueOnce(0);

      await service.calculateDailyRecommendations();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ runId: expect.any(String) }),
        expect.stringContaining('lock expired before the run finished'),
      );
      expect(metrics.recordMatchmakingDailyJobRun).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'success' }),
      );
    });

    it('warns, but still finishes, when the lock cannot be released', async () => {
      const { service, table, redis, logger, metrics } = createHarness();
      table.learners = [learner('learner-a')];
      table.setPartners('en', 'es', partners(2));
      redis.eval.mockRejectedValueOnce(new Error('Connection is closed.'));

      await expect(
        service.calculateDailyRecommendations(),
      ).resolves.toBeUndefined();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ runId: expect.any(String) }),
        expect.stringContaining('Could not release'),
      );
      expect(metrics.recordMatchmakingDailyJobRun).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'success' }),
      );
    });
  });

  describe('completion time', () => {
    it.each([
      ['succeeds', undefined],
      ['only refreshes some pairs', 'en->fr'],
    ])(
      'records when the cache was refreshed after a run that %s',
      async (_label, failingPair) => {
        const { service, table, redis } = createHarness();
        table.learners = [
          learner('learner-es', 'en', 'es'),
          learner('learner-fr', 'en', 'fr'),
        ];
        table.setPartners('en', 'es', partners(2));
        table.setPartners('en', 'fr', partners(2));
        if (failingPair) table.failingPairs.add(failingPair);
        const before = Math.floor(Date.now() / 1000);

        await service.calculateDailyRecommendations();

        const recorded = Number(redis.store.get(LAST_COMPLETED_KEY));
        expect(recorded).toBeGreaterThanOrEqual(before);
        expect(recorded).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
        // No TTL: a stale timestamp is exactly the signal worth alerting on.
        expect(redis.ttls.has(LAST_COMPLETED_KEY)).toBe(false);
      },
    );

    it('does not advance after a failed run', async () => {
      const { service, table, redis } = createHarness();
      table.learners = [learner('learner-a')];
      table.failingPairs.add(pairKey('en', 'es'));

      await service.calculateDailyRecommendations();

      expect(redis.store.has(LAST_COMPLETED_KEY)).toBe(false);
    });

    it('does not advance when another replica ran the job', async () => {
      const { service, redis } = createHarness();
      redis.store.set(LOCK_KEY, 'other-replica');

      await service.calculateDailyRecommendations();

      expect(redis.store.has(LAST_COMPLETED_KEY)).toBe(false);
    });

    it('keeps the completion key outside the recommendation cache namespace', async () => {
      const { service, table, redis } = createHarness();
      table.learners = [learner('learner-a')];
      table.setPartners('en', 'es', partners(2));

      await service.calculateDailyRecommendations();

      expect(LAST_COMPLETED_KEY.startsWith('recommendations:daily:')).toBe(
        false,
      );
      expect(redis.cachedKeys()).toEqual(['recommendations:daily:learner-a']);
    });

    it('still succeeds when the completion time cannot be written', async () => {
      const { service, table, redis, logger, metrics } = createHarness();
      table.learners = [learner('learner-a')];
      table.setPartners('en', 'es', partners(2));
      redis.failSetFor = LAST_COMPLETED_KEY;

      await expect(
        service.calculateDailyRecommendations(),
      ).resolves.toBeUndefined();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ runId: expect.any(String) }),
        expect.stringContaining('completion time'),
      );
      expect(metrics.recordMatchmakingDailyJobRun).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'success' }),
      );
    });
  });

  describe('observability', () => {
    it('records one metrics sample per run with its volume and duration', async () => {
      const { service, table, metrics } = createHarness();
      table.learners = [learner('learner-a'), learner('learner-b')];
      table.setPartners('en', 'es', partners(3));

      await service.calculateDailyRecommendations();

      expect(metrics.recordMatchmakingDailyJobRun).toHaveBeenCalledTimes(1);
      expect(metrics.recordMatchmakingDailyJobRun).toHaveBeenCalledWith({
        outcome: 'success',
        durationSeconds: expect.any(Number),
        learnersScanned: 2,
        setsCached: 2,
        truncated: false,
      });
    });

    it('does not let a metrics failure fail the run', async () => {
      const { service, table, redis, metrics, logger } = createHarness();
      table.learners = [learner('learner-a')];
      table.setPartners('en', 'es', partners(2));
      metrics.recordMatchmakingDailyJobRun.mockImplementation(() => {
        throw new Error('registry closed');
      });

      await expect(
        service.calculateDailyRecommendations(),
      ).resolves.toBeUndefined();

      expect(redis.cachedKeys()).toHaveLength(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ runId: expect.any(String) }),
        expect.stringContaining('Could not record'),
      );
    });

    it('correlates every log line with one run id and logs no personal data', async () => {
      const { service, table, logger } = createHarness();
      table.learners = [learner('learner-a'), learner('learner-b', 'en', 'fr')];
      table.setPartners('en', 'es', [partner('secret-partner')]);
      table.failingPairs.add(pairKey('en', 'fr'));

      await service.calculateDailyRecommendations();

      const logged = [
        ...logger.info.mock.calls,
        ...logger.warn.mock.calls,
        ...logger.error.mock.calls,
      ] as Array<[unknown, string]>;
      const runIds = new Set(
        logged.map(([fields]) => (fields as { runId?: string }).runId),
      );
      expect(runIds.size).toBe(1);
      expect([...runIds][0]).toEqual(expect.any(String));

      const serialised = JSON.stringify(logged);
      for (const personal of [
        'learner-a',
        'learner-b',
        'secret-partner',
        'Partner secret-partner',
        'user abc',
      ]) {
        expect(serialised).not.toContain(personal);
      }
    });

    it('summarises each run with its outcome and counts', async () => {
      const { service, table, logger } = createHarness();
      table.learners = [learner('learner-a')];
      table.setPartners('en', 'es', partners(2));

      await service.calculateDailyRecommendations();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'success',
          pagesScanned: 1,
          learnersScanned: 1,
          pairQueries: 1,
          failedPairQueries: 0,
          setsCached: 1,
          truncated: false,
          durationMs: expect.any(Number),
        }),
        'Daily recommendation calculation finished',
      );
    });
  });
});
