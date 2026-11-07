import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { SupabaseAuthGuard } from '../src/auth/supabase-auth.guard';
import { MediaService } from '../src/media/media.service';
import { MetricsService } from '../src/metrics/metrics.service';
import { SafetyController } from '../src/safety/safety.controller';
import { SafetyService } from '../src/safety/safety.service';
import { SafetyCacheInvalidationService } from '../src/safety/safety-cache-invalidation.service';
import { SupabaseService } from '../src/supabase/supabase.service';
import { TwoFactorGuard } from '../src/two-factor/two-factor.guard';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';

/**
 * Block and report E2E (#1831). Runs the real controllers, validation pipe,
 * throttler and SafetyService against an in-memory database that enforces the
 * same uniqueness rules as the migrations, so idempotency, validation, status
 * codes and abuse limits are exercised through the HTTP pipeline. The legacy
 * `/users` routes are mounted too, to prove they cannot bypass those rules.
 */

type Row = Record<string, any>;
type DbResult = {
  data: any;
  error: { code: string; message: string } | null;
  count?: number | null;
};

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const SHOP = '33333333-3333-4333-8333-333333333333';
const GHOST = '99999999-9999-4999-8999-999999999999';

class FakeDatabase {
  readonly tables: Record<string, Row[]> = {
    users: [{ id: ALICE }, { id: BOB }, { id: SHOP }],
    blocks: [],
    reports: [],
  };
  private sequence = 0;
  failNextWriteOn: string | null = null;

  nextId(): string {
    this.sequence += 1;
    return `00000000-0000-4000-8000-${String(this.sequence).padStart(12, '0')}`;
  }

  violatesUnique(table: string, row: Row): boolean {
    if (table === 'blocks') {
      return this.tables.blocks.some(
        (b) =>
          b.blocker_id === row.blocker_id && b.blocked_id === row.blocked_id,
      );
    }
    if (table === 'reports' && row.status === 'pending') {
      return this.tables.reports.some(
        (r) =>
          r.status === 'pending' &&
          r.reporter_id === row.reporter_id &&
          r.reported_user_id === row.reported_user_id &&
          r.reason_category === row.reason_category,
      );
    }
    return false;
  }

  from(table: string): FakeQuery {
    return new FakeQuery(this, table);
  }
}

class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private operation: 'select' | 'insert' | 'upsert' | 'delete' = 'select';
  private payload: Row = {};
  private ignoreDuplicates = false;
  private returning = false;
  private head = false;
  private counting = false;
  private ordering: { column: string; ascending: boolean } | null = null;
  private max: number | null = null;

  constructor(
    private readonly db: FakeDatabase,
    private readonly table: string,
  ) {}

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    if (this.operation === 'select') {
      this.counting = options?.count === 'exact';
      this.head = options?.head === true;
    } else {
      this.returning = true;
    }
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }
  gte(column: string, value: string) {
    this.filters.push((row) => String(row[column]) >= value);
    return this;
  }
  order(column: string, options: { ascending: boolean }) {
    this.ordering = { column, ascending: options.ascending };
    return this;
  }
  limit(count: number) {
    this.max = count;
    return this;
  }
  insert(row: Row) {
    this.operation = 'insert';
    this.payload = row;
    return this;
  }
  upsert(row: Row, options?: { ignoreDuplicates?: boolean }) {
    this.operation = 'upsert';
    this.payload = row;
    this.ignoreDuplicates = options?.ignoreDuplicates === true;
    return this;
  }
  delete() {
    this.operation = 'delete';
    return this;
  }

  async maybeSingle(): Promise<DbResult> {
    const result = await this.execute();
    return { ...result, data: result.data?.[0] ?? null };
  }
  async single(): Promise<DbResult> {
    const result = await this.execute();
    if (!result.error && !result.data?.length) {
      return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
    }
    return { ...result, data: result.data?.[0] ?? null };
  }
  then(resolve: (value: DbResult) => unknown, reject: (e: unknown) => unknown) {
    return this.execute().then(resolve, reject);
  }

  private matches(): Row[] {
    let rows = this.db.tables[this.table].filter((row) =>
      this.filters.every((filter) => filter(row)),
    );
    if (this.ordering) {
      const { column, ascending } = this.ordering;
      rows = [...rows].sort((a, b) =>
        ascending
          ? String(a[column]).localeCompare(String(b[column]))
          : String(b[column]).localeCompare(String(a[column])),
      );
    }
    return this.max === null ? rows : rows.slice(0, this.max);
  }

  private execute(): Promise<DbResult> {
    return Promise.resolve(this.run());
  }

  private run(): DbResult {
    if (this.operation !== 'select' && this.db.failNextWriteOn === this.table) {
      this.db.failNextWriteOn = null;
      return {
        data: null,
        error: { code: '57P01', message: 'secret connection string leaked' },
      };
    }

    if (this.operation === 'select') {
      const rows = this.matches();
      return this.counting
        ? { data: this.head ? null : rows, error: null, count: rows.length }
        : { data: rows, error: null };
    }

    if (this.operation === 'delete') {
      const doomed = this.matches();
      this.db.tables[this.table] = this.db.tables[this.table].filter(
        (row) => !doomed.includes(row),
      );
      return { data: this.returning ? doomed : null, error: null };
    }

    if (this.db.violatesUnique(this.table, this.payload)) {
      return this.operation === 'upsert' && this.ignoreDuplicates
        ? { data: [], error: null }
        : { data: null, error: { code: '23505', message: 'duplicate key' } };
    }

    const row = {
      id: this.db.nextId(),
      created_at: new Date().toISOString(),
      ...this.payload,
    };
    this.db.tables[this.table].push(row);
    return { data: this.returning ? [row] : null, error: null };
  }
}

describe('Block and report E2E (#1831)', () => {
  let app: INestApplication;
  let db: FakeDatabase;
  const metrics = {
    recordTsReportSubmitted: vi.fn(),
    recordTsBlockCreated: vi.fn(),
    recordTsBlockRemoved: vi.fn(),
    recordTsSafetyOperation: vi.fn(),
  };
  const cache = {
    invalidateUserCaches: vi.fn().mockResolvedValue(undefined),
    invalidateUserPairCaches: vi.fn().mockResolvedValue(undefined),
    invalidateTrustAndSafetyCaches: vi.fn().mockResolvedValue(undefined),
  };

  const as = (userId: string) => ({ 'x-test-user': userId });

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    Object.values(metrics).forEach((fn) => fn.mockClear());
    Object.values(cache).forEach((fn) => fn.mockClear());
    db = new FakeDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }])],
      controllers: [SafetyController, UsersController],
      providers: [
        SafetyService,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: SupabaseService, useValue: { getClient: () => db } },
        { provide: MetricsService, useValue: metrics },
        { provide: SafetyCacheInvalidationService, useValue: cache },
        // Only the block and report routes of UsersController are exercised.
        { provide: UsersService, useValue: {} },
        { provide: MediaService, useValue: {} },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          const userId = req.headers['x-test-user'];
          if (!userId) return false;
          req.user = { id: userId };
          return true;
        },
      })
      .overrideGuard(TwoFactorGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    // Bind once so parallel supertest requests share a listening server instead
    // of each opening, and then closing, their own.
    await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  describe('authentication', () => {
    it.each([
      ['post', '/safety/report'],
      ['post', '/safety/block'],
      ['post', '/safety/unblock'],
      ['post', `/safety/block/${BOB}`],
      ['get', '/safety/blocked-ids'],
    ] as const)('rejects unauthenticated %s %s', async (method, path) => {
      await request(app.getHttpServer())[method](path).expect(403);
      expect(db.tables.reports).toHaveLength(0);
      expect(db.tables.blocks).toHaveLength(0);
    });
  });

  describe('reporting a user or business', () => {
    const body = (overrides: Record<string, unknown> = {}) => ({
      reported_id: SHOP,
      reason_category: 'spam',
      description: 'Unwanted promotion',
      context_url: '/profile/business',
      ...overrides,
    });

    it('creates one pending report and returns its id', async () => {
      const response = await request(app.getHttpServer())
        .post('/safety/report')
        .set(as(ALICE))
        .send(body())
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        duplicate: false,
        report_id: db.tables.reports[0].id,
      });
      expect(db.tables.reports).toEqual([
        expect.objectContaining({
          reporter_id: ALICE,
          reported_user_id: SHOP,
          reason_category: 'spam',
          description: 'Unwanted promotion',
          context_url: '/profile/business',
          status: 'pending',
        }),
      ]);
      expect(metrics.recordTsSafetyOperation).toHaveBeenCalledWith(
        'report',
        'success',
      );
    });

    it('is idempotent: repeating an open report returns the same report without a second row', async () => {
      const first = await request(app.getHttpServer())
        .post('/safety/report')
        .set(as(ALICE))
        .send(body())
        .expect(201);
      const second = await request(app.getHttpServer())
        .post('/safety/report')
        .set(as(ALICE))
        .send(body({ description: 'Added later' }))
        .expect(201);

      expect(second.body.duplicate).toBe(true);
      expect(second.body.report_id).toBe(first.body.report_id);
      expect(db.tables.reports).toHaveLength(1);
      expect(metrics.recordTsReportSubmitted).toHaveBeenCalledTimes(1);
    });

    it('collapses a burst of identical concurrent submissions into one report', async () => {
      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app.getHttpServer())
            .post('/safety/report')
            .set(as(ALICE))
            .send(body()),
        ),
      );

      expect(responses.every((r) => r.status === 201)).toBe(true);
      expect(new Set(responses.map((r) => r.body.report_id)).size).toBe(1);
      expect(db.tables.reports).toHaveLength(1);
      expect(metrics.recordTsReportSubmitted).toHaveBeenCalledTimes(1);
    });

    it('allows a different reporter, or a different reason, to open a separate report', async () => {
      await request(app.getHttpServer())
        .post('/safety/report')
        .set(as(ALICE))
        .send(body())
        .expect(201);
      await request(app.getHttpServer())
        .post('/safety/report')
        .set(as(BOB))
        .send(body())
        .expect(201);
      await request(app.getHttpServer())
        .post('/safety/report')
        .set(as(ALICE))
        .send(body({ reason_category: 'fake_profile' }))
        .expect(201);

      expect(db.tables.reports).toHaveLength(3);
    });

    it('lets a person report again once the earlier report has been resolved', async () => {
      await request(app.getHttpServer())
        .post('/safety/report')
        .set(as(ALICE))
        .send(body())
        .expect(201);
      db.tables.reports[0].status = 'approved';

      const again = await request(app.getHttpServer())
        .post('/safety/report')
        .set(as(ALICE))
        .send(body())
        .expect(201);

      expect(again.body.duplicate).toBe(false);
      expect(db.tables.reports).toHaveLength(2);
    });

    it('enforces the rolling daily limit on distinct reports with 429', async () => {
      for (let i = 0; i < 20; i += 1) {
        db.tables.reports.push({
          id: db.nextId(),
          reporter_id: ALICE,
          reported_user_id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`,
          reason_category: 'spam',
          status: 'approved',
          created_at: new Date().toISOString(),
        });
      }

      await request(app.getHttpServer())
        .post('/safety/report')
        .set(as(ALICE))
        .send(body())
        .expect(429);

      expect(db.tables.reports).toHaveLength(20);
      expect(metrics.recordTsSafetyOperation).toHaveBeenCalledWith(
        'report',
        'rate_limited',
      );
    });

    it.each([
      ['a non-UUID target', { reported_id: 'user-1' }],
      ['an unknown category', { reason_category: 'scam' }],
      ['a javascript: context link', { context_url: 'javascript:alert(1)' }],
      [
        'a protocol-relative context link',
        { context_url: '//evil.example.com' },
      ],
      ['an over-long description', { description: 'x'.repeat(501) }],
      ['an unexpected property', { status: 'approved' }],
    ])('rejects %s with 400 and stores nothing', async (_label, overrides) => {
      await request(app.getHttpServer())
        .post('/safety/report')
        .set(as(ALICE))
        .send(body(overrides))
        .expect(400);

      expect(db.tables.reports).toHaveLength(0);
    });

    it('rejects reporting yourself with 400', async () => {
      await request(app.getHttpServer())
        .post('/safety/report')
        .set(as(ALICE))
        .send(body({ reported_id: ALICE }))
        .expect(400);
      expect(db.tables.reports).toHaveLength(0);
    });

    it('returns 404 for an account that does not exist', async () => {
      await request(app.getHttpServer())
        .post('/safety/report')
        .set(as(ALICE))
        .send(body({ reported_id: GHOST }))
        .expect(404);
      expect(db.tables.reports).toHaveLength(0);
    });

    it('returns a generic 500 without provider detail when persistence fails', async () => {
      db.failNextWriteOn = 'reports';

      const response = await request(app.getHttpServer())
        .post('/safety/report')
        .set(as(ALICE))
        .send(body())
        .expect(500);

      expect(JSON.stringify(response.body)).not.toContain(
        'secret connection string',
      );
      expect(response.body.message).toBe('Unable to submit report');
      expect(db.tables.reports).toHaveLength(0);
      expect(metrics.recordTsReportSubmitted).not.toHaveBeenCalled();
    });

    it('limits submissions to five a minute per client', async () => {
      const limited = await Test.createTestingModule({
        imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }])],
        controllers: [SafetyController],
        providers: [
          SafetyService,
          { provide: APP_GUARD, useClass: ThrottlerGuard },
          { provide: SupabaseService, useValue: { getClient: () => db } },
          { provide: MetricsService, useValue: metrics },
          { provide: SafetyCacheInvalidationService, useValue: cache },
        ],
      })
        .overrideGuard(SupabaseAuthGuard)
        .useValue({
          canActivate: (context: any) => {
            context.switchToHttp().getRequest().user = { id: ALICE };
            return true;
          },
        })
        .compile();
      const limitedApp = limited.createNestApplication();
      limitedApp.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await limitedApp.init();
      await limitedApp.listen(0);

      const statuses: number[] = [];
      for (let i = 0; i < 7; i += 1) {
        const res = await request(limitedApp.getHttpServer())
          .post('/safety/report')
          .send({ reported_id: SHOP, reason_category: 'spam' });
        statuses.push(res.status);
      }
      await limitedApp.close();

      expect(statuses).toEqual([201, 201, 201, 201, 201, 429, 429]);
    });
  });

  describe('blocking a user or business', () => {
    it('blocks, and a repeated block is a successful no-op', async () => {
      const first = await request(app.getHttpServer())
        .post(`/safety/block/${SHOP}`)
        .set(as(ALICE))
        .expect(201);
      const second = await request(app.getHttpServer())
        .post(`/safety/block/${SHOP}`)
        .set(as(ALICE))
        .expect(201);

      expect(first.body).toEqual({
        success: true,
        blocked_id: SHOP,
        already_blocked: false,
      });
      expect(second.body).toEqual({
        success: true,
        blocked_id: SHOP,
        already_blocked: true,
      });
      expect(db.tables.blocks).toHaveLength(1);
      expect(metrics.recordTsBlockCreated).toHaveBeenCalledTimes(1);
      expect(cache.invalidateUserPairCaches).toHaveBeenCalledTimes(2);
    });

    it('supports the body form and reports the block in the caller list', async () => {
      await request(app.getHttpServer())
        .post('/safety/block')
        .set(as(ALICE))
        .send({ blocked_id: BOB })
        .expect(201);

      const list = await request(app.getHttpServer())
        .get('/safety/blocked-ids')
        .set(as(ALICE))
        .expect(200);
      const otherUser = await request(app.getHttpServer())
        .get('/safety/blocked-ids')
        .set(as(BOB))
        .expect(200);

      expect(list.body).toEqual([BOB]);
      expect(otherUser.body).toEqual([]);
    });

    it('collapses concurrent block requests into one row', async () => {
      const responses = await Promise.all(
        Array.from({ length: 4 }, () =>
          request(app.getHttpServer())
            .post(`/safety/block/${SHOP}`)
            .set(as(ALICE)),
        ),
      );

      expect(responses.every((r) => r.status === 201)).toBe(true);
      expect(db.tables.blocks).toHaveLength(1);
      expect(
        responses.filter((r) => r.body.already_blocked === false),
      ).toHaveLength(1);
      expect(metrics.recordTsBlockCreated).toHaveBeenCalledTimes(1);
    });

    it.each([
      [
        'a non-UUID path parameter',
        () => request(app.getHttpServer()).post('/safety/block/not-a-uuid'),
      ],
      [
        'a non-UUID body',
        () =>
          request(app.getHttpServer())
            .post('/safety/block')
            .send({ blocked_id: 'x' }),
      ],
      [
        'an empty body',
        () => request(app.getHttpServer()).post('/safety/block').send({}),
      ],
    ])('rejects %s with 400', async (_label, send) => {
      await send().set(as(ALICE)).expect(400);
      expect(db.tables.blocks).toHaveLength(0);
    });

    it('rejects blocking yourself with 400 and an unknown account with 404', async () => {
      await request(app.getHttpServer())
        .post(`/safety/block/${ALICE}`)
        .set(as(ALICE))
        .expect(400);
      await request(app.getHttpServer())
        .post(`/safety/block/${GHOST}`)
        .set(as(ALICE))
        .expect(404);
      expect(db.tables.blocks).toHaveLength(0);
    });

    it('returns a generic 500 and no block when persistence fails, so the UI cannot show a false success', async () => {
      db.failNextWriteOn = 'blocks';

      const response = await request(app.getHttpServer())
        .post(`/safety/block/${SHOP}`)
        .set(as(ALICE))
        .expect(500);

      expect(JSON.stringify(response.body)).not.toContain(
        'secret connection string',
      );
      expect(db.tables.blocks).toHaveLength(0);
      expect(metrics.recordTsBlockCreated).not.toHaveBeenCalled();
    });
  });

  describe('unblocking', () => {
    it('removes only the caller block and repeats are successful no-ops', async () => {
      db.tables.blocks.push(
        { id: db.nextId(), blocker_id: ALICE, blocked_id: SHOP },
        { id: db.nextId(), blocker_id: BOB, blocked_id: SHOP },
      );

      await request(app.getHttpServer())
        .post(`/safety/unblock/${SHOP}`)
        .set(as(ALICE))
        .expect(201)
        .expect({ success: true });
      await request(app.getHttpServer())
        .post(`/safety/unblock/${SHOP}`)
        .set(as(ALICE))
        .expect(201)
        .expect({ success: true });

      expect(db.tables.blocks).toEqual([
        expect.objectContaining({ blocker_id: BOB, blocked_id: SHOP }),
      ]);
      expect(metrics.recordTsBlockRemoved).toHaveBeenCalledTimes(1);
    });

    it('rejects a malformed identifier with 400', async () => {
      await request(app.getHttpServer())
        .post('/safety/unblock')
        .set(as(ALICE))
        .send({ blocked_id: 'nope' })
        .expect(400);
    });
  });

  describe('privacy of other people block graphs', () => {
    it.each([
      `/safety/blocked-ids/${BOB}`,
      `/safety/blocker-ids/${BOB}`,
      `/safety/blocked-and-blocker-ids/${BOB}`,
    ])('forbids reading someone else through %s', async (path) => {
      await request(app.getHttpServer()).get(path).set(as(ALICE)).expect(403);
    });
  });

  describe('identifier casing', () => {
    it('treats an upper-case copy of your own id as a self-block and a self-report', async () => {
      await request(app.getHttpServer())
        .post(`/safety/block/${ALICE.toUpperCase()}`)
        .set(as(ALICE))
        .expect(400);
      await request(app.getHttpServer())
        .post('/safety/report')
        .set(as(ALICE))
        .send({
          reported_id: ALICE.toUpperCase(),
          reason_category: 'spam',
        })
        .expect(400);

      expect(db.tables.blocks).toHaveLength(0);
      expect(db.tables.reports).toHaveLength(0);
    });

    it('stores and caches the canonical id when the target is sent in upper case', async () => {
      await request(app.getHttpServer())
        .post(`/safety/block/${SHOP.toUpperCase()}`)
        .set(as(ALICE))
        .expect(201)
        .expect({ success: true, blocked_id: SHOP, already_blocked: false });

      expect(db.tables.blocks[0]).toMatchObject({
        blocker_id: ALICE,
        blocked_id: SHOP,
      });
      expect(cache.invalidateUserPairCaches).toHaveBeenCalledWith(ALICE, SHOP);
    });
  });

  describe('legacy /users routes share the same rules (#1831)', () => {
    it('POST /users/report validates, de-duplicates and returns the open report', async () => {
      const payload = { reported_id: SHOP, reason_category: 'spam' };

      const first = await request(app.getHttpServer())
        .post('/users/report')
        .set(as(ALICE))
        .send(payload)
        .expect(201);
      const second = await request(app.getHttpServer())
        .post('/users/report')
        .set(as(ALICE))
        .send(payload)
        .expect(201);

      expect(first.body).toMatchObject({ success: true, duplicate: false });
      expect(second.body).toMatchObject({
        report_id: first.body.report_id,
        duplicate: true,
      });
      expect(db.tables.reports).toHaveLength(1);
    });

    it('shares the open-report slot with POST /safety/report', async () => {
      const viaSafety = await request(app.getHttpServer())
        .post('/safety/report')
        .set(as(ALICE))
        .send({ reported_id: SHOP, reason_category: 'spam' })
        .expect(201);
      const viaUsers = await request(app.getHttpServer())
        .post('/users/report')
        .set(as(ALICE))
        .send({ reported_id: SHOP, reason_category: 'spam' })
        .expect(201);

      expect(viaUsers.body.report_id).toBe(viaSafety.body.report_id);
      expect(db.tables.reports).toHaveLength(1);
    });

    it.each([
      ['a non-UUID target', { reported_id: 'user-1', reason_category: 'spam' }],
      ['a free-text category', { reported_id: SHOP, reason_category: 'scam' }],
      [
        'an unexpected property',
        { reported_id: SHOP, reason_category: 'spam', status: 'approved' },
      ],
    ])('POST /users/report rejects %s with 400', async (_label, payload) => {
      await request(app.getHttpServer())
        .post('/users/report')
        .set(as(ALICE))
        .send(payload)
        .expect(400);
      expect(db.tables.reports).toHaveLength(0);
    });

    it('POST /users/report cannot be used to get around the daily report limit', async () => {
      for (let i = 0; i < 20; i += 1) {
        db.tables.reports.push({
          id: db.nextId(),
          reporter_id: ALICE,
          reported_user_id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(i).padStart(12, '0')}`,
          reason_category: 'spam',
          status: 'approved',
          created_at: new Date().toISOString(),
        });
      }

      await request(app.getHttpServer())
        .post('/users/report')
        .set(as(ALICE))
        .send({ reported_id: SHOP, reason_category: 'spam' })
        .expect(429);

      expect(db.tables.reports).toHaveLength(20);
    });

    it('POST /users/block/:id is idempotent, validated and refreshes caches', async () => {
      await request(app.getHttpServer())
        .post(`/users/block/${SHOP}`)
        .set(as(ALICE))
        .expect(201)
        .expect({ success: true, blocked_id: SHOP, already_blocked: false });
      await request(app.getHttpServer())
        .post(`/users/block/${SHOP}`)
        .set(as(ALICE))
        .expect(201)
        .expect({ success: true, blocked_id: SHOP, already_blocked: true });
      await request(app.getHttpServer())
        .post('/users/block/not-a-uuid')
        .set(as(ALICE))
        .expect(400);
      await request(app.getHttpServer())
        .post(`/users/block/${ALICE}`)
        .set(as(ALICE))
        .expect(400);
      await request(app.getHttpServer())
        .post(`/users/block/${GHOST}`)
        .set(as(ALICE))
        .expect(404);

      expect(db.tables.blocks).toHaveLength(1);
      expect(cache.invalidateUserPairCaches).toHaveBeenCalledWith(ALICE, SHOP);
    });

    it('DELETE /users/block/:id removes only the caller block and repeats succeed', async () => {
      db.tables.blocks.push(
        { id: db.nextId(), blocker_id: ALICE, blocked_id: SHOP },
        { id: db.nextId(), blocker_id: BOB, blocked_id: SHOP },
      );

      await request(app.getHttpServer())
        .delete(`/users/block/${SHOP}`)
        .set(as(ALICE))
        .expect(200)
        .expect({ success: true });
      await request(app.getHttpServer())
        .delete(`/users/block/${SHOP}`)
        .set(as(ALICE))
        .expect(200)
        .expect({ success: true });
      await request(app.getHttpServer())
        .delete('/users/block/not-a-uuid')
        .set(as(ALICE))
        .expect(400);

      expect(db.tables.blocks).toEqual([
        expect.objectContaining({ blocker_id: BOB, blocked_id: SHOP }),
      ]);
    });

    it('rejects unauthenticated legacy calls', async () => {
      await request(app.getHttpServer())
        .post('/users/report')
        .send({ reported_id: SHOP, reason_category: 'spam' })
        .expect(403);
      await request(app.getHttpServer())
        .post(`/users/block/${SHOP}`)
        .expect(403);
      expect(db.tables.reports).toHaveLength(0);
      expect(db.tables.blocks).toHaveLength(0);
    });
  });
});
