import type { Mock, MockInstance } from 'vitest';
// Mock jsdom and dompurify to avoid ESM import failures in Vitest
vi.mock('jsdom', () => ({
  JSDOM: vi.fn().mockImplementation(function () {
    return {
      window: {
        document: {
          createElement: vi.fn(),
          createDocumentFragment: vi.fn(),
        },
        Node: {
          ELEMENT_NODE: 1,
          TEXT_NODE: 3,
          DOCUMENT_FRAGMENT_NODE: 11,
        },
        NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 },
      },
    };
  }),
}));

vi.mock('dompurify', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    sanitize: (dirty: string): string => {
      if (typeof dirty !== 'string') return dirty;
      return dirty
        .replace(/<[^>]*>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'");
    },
    setConfig: vi.fn(),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReadingEngineService } from './reading-engine.service';
import {
  SupabaseService,
  ReadingResourceRow,
  ReadingProgressRow,
} from '../supabase/supabase.service';
import { ReadingEngineCacheService } from './reading-engine-cache.service';

/** Builds a chainable mock that mimics the Supabase query builder pattern. */
function makeBuilder(response: unknown) {
  const builder: Record<string, Mock> = {};
  const methods = [
    'from',
    'insert',
    'update',
    'delete',
    'select',
    'eq',
    'order',
    'single',
    'limit',
    'range',
    'rpc',
  ];
  for (const method of methods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.then = (
    resolve: (value: unknown) => void,
    reject?: (reason: unknown) => void,
  ) => Promise.resolve(response).then(resolve, reject);
  return builder;
}

describe('ReadingEngineService', () => {
  let service: ReadingEngineService;
  let mockDb: Record<string, ReturnType<typeof makeBuilder>>;
  let mockCacheService: { get: Mock; set: Mock };
  let mockEventEmitter: { emit: Mock };
  let _errorSpy: MockInstance;

  beforeEach(async () => {
    _errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    mockDb = {};
    mockCacheService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      buildKey: vi.fn(
        (opts: {
          namespace: string;
          userId: string;
          resourceId?: string;
          extra?: string;
        }) => {
          const parts: string[] = [opts.namespace, 'user', opts.userId];
          if (opts.resourceId) parts.push(opts.resourceId);
          if (opts.extra) parts.push(opts.extra);
          return parts.join(':');
        },
      ),
    };
    mockEventEmitter = { emit: vi.fn() };

    const mockSupabaseClient = {
      from: vi.fn((table: string) => {
        if (!mockDb[table]) {
          mockDb[table] = makeBuilder({ data: null, error: null });
        }
        return mockDb[table];
      }),
      rpc: vi.fn((_fn: string, _params: unknown) => {
        // handled inline via mockDb entries or direct rpc reactions
        return Promise.resolve({ data: null, error: null });
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadingEngineService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        { provide: ReadingEngineCacheService, useValue: mockCacheService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<ReadingEngineService>(ReadingEngineService);
  });

  afterEach(() => vi.restoreAllMocks());

  /* ------------------------------------------------------------------ */
  /*  createResource                                                    */
  /* ------------------------------------------------------------------ */

  describe('createResource', () => {
    const dto = {
      title: 'Test Resource',
      content: 'Hello world. This is a test.',
      language: 'en',
      difficulty: 'beginner',
      topic: 'greetings',
      sourceUrl: 'https://example.com',
    };

    it('creates a resource and returns the mapped ReadingResource', async () => {
      const row: ReadingResourceRow = {
        id: 'res-1',
        title: 'Test Resource',
        content: 'Hello world. This is a test.',
        language: 'en',
        difficulty: 'beginner',
        topic: 'greetings',
        source_url: 'https://example.com',
        created_by: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      mockDb['reading_resources'] = makeBuilder({ data: row, error: null });

      const result = await service.createResource('user-1', dto);

      expect(result).toEqual({
        id: 'res-1',
        title: 'Test Resource',
        content: 'Hello world. This is a test.',
        language: 'en',
        difficulty: 'beginner',
        topic: 'greetings',
        sourceUrl: 'https://example.com',
        createdBy: 'user-1',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'reading.resource_mutated',
      );
    });

    it('emits resource_mutated event on success', async () => {
      mockDb['reading_resources'] = makeBuilder({
        data: {
          id: 'r1',
          title: 'T',
          content: 'C',
          language: 'en',
          created_by: 'u1',
          created_at: '',
          updated_at: '',
        },
        error: null,
      });

      await service.createResource('u1', {
        title: 'T',
        content: 'C',
        language: 'en',
      });

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'reading.resource_mutated',
      );
    });

    it('throws if the insert returns a postgres error', async () => {
      mockDb['reading_resources'] = makeBuilder({
        data: null,
        error: { message: 'constraint violation' },
      });

      await expect(
        service.createResource('u1', {
          title: 'T',
          content: 'C',
          language: 'en',
        }),
      ).rejects.toMatchObject({ message: 'constraint violation' });
    });

    it('throws NotFoundException if no data is returned', async () => {
      mockDb['reading_resources'] = makeBuilder({ data: null, error: null });

      await expect(
        service.createResource('u1', {
          title: 'T',
          content: 'C',
          language: 'en',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('inserts optional fields as null when omitted', async () => {
      let insertPayload: unknown = undefined;
      const builder = makeBuilder({
        data: {
          id: 'r1',
          title: 'T',
          content: 'C',
          language: 'en',
          created_by: 'u1',
          created_at: '',
          updated_at: '',
        },
        error: null,
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const origInsert = builder.insert;
      builder.insert = vi.fn((payload: unknown) => {
        insertPayload = payload;
        return builder;
      });
      mockDb['reading_resources'] = builder;

      await service.createResource('u1', {
        title: 'T',
        content: 'C',
        language: 'en',
      });

      expect((insertPayload as Record<string, unknown>).difficulty).toBeNull();
      expect((insertPayload as Record<string, unknown>).topic).toBeNull();
      expect((insertPayload as Record<string, unknown>).source_url).toBeNull();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  updateResource                                                    */
  /* ------------------------------------------------------------------ */

  describe('updateResource', () => {
    it('updates allowed fields and returns the mapped resource', async () => {
      const row: ReadingResourceRow = {
        id: 'res-1',
        title: 'Updated Title',
        content: 'Updated content.',
        language: 'fr',
        difficulty: 'advanced',
        topic: 'science',
        source_url: null,
        created_by: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
      };
      mockDb['reading_resources'] = makeBuilder({ data: row, error: null });

      const result = await service.updateResource('res-1', {
        title: 'Updated Title',
        content: 'Updated content.',
        language: 'fr',
        difficulty: 'advanced',
        topic: 'science',
      });

      expect(result.title).toBe('Updated Title');
      expect(result.language).toBe('fr');
      expect(result.difficulty).toBe('advanced');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'reading.resource_mutated',
      );
    });

    it('omits undefined fields from the update payload', async () => {
      const row: ReadingResourceRow = {
        id: 'res-1',
        title: 'Old',
        content: 'Old',
        language: 'en',
        created_by: 'u1',
        created_at: '',
        updated_at: '',
      };
      mockDb['reading_resources'] = makeBuilder({ data: row, error: null });

      const result = await service.updateResource('res-1', {
        title: 'New Title',
      });

      expect(result.title).toBe('Old'); // mock returns the row we gave it, so title is 'Old'
      // The key assertion: update was called with only title
      expect(mockDb['reading_resources'].update).toHaveBeenCalledWith({
        title: 'New Title',
      });
    });

    it('throws NotFoundException when resource does not exist', async () => {
      mockDb['reading_resources'] = makeBuilder({ data: null, error: null });

      await expect(
        service.updateResource('nonexistent', { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws if update query fails', async () => {
      mockDb['reading_resources'] = makeBuilder({
        data: null,
        error: { message: 'db error' },
      });

      await expect(
        service.updateResource('res-1', { title: 'X' }),
      ).rejects.toMatchObject({ message: 'db error' });
    });
  });

  /* ------------------------------------------------------------------ */
  /*  getResource                                                       */
  /* ------------------------------------------------------------------ */

  describe('getResource', () => {
    const row: ReadingResourceRow = {
      id: 'res-1',
      title: 'Cached',
      content: 'Content',
      language: 'en',
      created_by: 'u1',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('returns a cached resource when available', async () => {
      const cached = {
        id: 'res-1',
        title: 'Cached',
        content: 'Content',
        language: 'en',
        createdBy: 'u1',
        createdAt: '',
        updatedAt: '',
      };
      mockCacheService.get.mockResolvedValue(cached);

      const result = await service.getResource('res-1');

      expect(result).toEqual(cached);
      expect(mockCacheService.get).toHaveBeenCalled();
    });

    it('fetches from database on cache miss and caches the result', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockDb['reading_resources'] = makeBuilder({ data: row, error: null });

      const result = await service.getResource('res-1');

      expect(result.id).toBe('res-1');
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('throws NotFoundException when resource is missing', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockDb['reading_resources'] = makeBuilder({ data: null, error: null });

      await expect(service.getResource('res-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws database error when query fails', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockDb['reading_resources'] = makeBuilder({
        data: null,
        error: { message: 'db error' },
      });

      await expect(service.getResource('res-1')).rejects.toMatchObject({
        message: 'db error',
      });
    });
  });

  /* ------------------------------------------------------------------ */
  /*  listResources                                                     */
  /* ------------------------------------------------------------------ */

  describe('listResources', () => {
    const rows: ReadingResourceRow[] = [
      {
        id: 'r1',
        title: 'A',
        content: 'A',
        language: 'en',
        created_by: 'u1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '',
      },
      {
        id: 'r2',
        title: 'B',
        content: 'B',
        language: 'en',
        created_by: 'u1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '',
      },
    ];

    it('returns all resources when no filters supplied', async () => {
      mockDb['reading_resources'] = makeBuilder({ data: rows, error: null });

      const result = await service.listResources({});

      expect(result).toHaveLength(2);
    });

    it('applies language filter', async () => {
      const builder = makeBuilder({ data: rows, error: null });
      mockDb['reading_resources'] = builder;

      await service.listResources({ language: 'en' });

      expect(builder.eq).toHaveBeenCalledWith('language', 'en');
    });

    it('applies difficulty filter', async () => {
      const builder = makeBuilder({ data: rows, error: null });
      mockDb['reading_resources'] = builder;

      await service.listResources({ difficulty: 'beginner' });

      expect(builder.eq).toHaveBeenCalledWith('difficulty', 'beginner');
    });

    it('applies topic filter', async () => {
      const builder = makeBuilder({ data: rows, error: null });
      mockDb['reading_resources'] = builder;

      await service.listResources({ topic: 'science' });

      expect(builder.eq).toHaveBeenCalledWith('topic', 'science');
    });

    it('applies limit and offset together using range', async () => {
      const builder = makeBuilder({ data: rows, error: null });
      mockDb['reading_resources'] = builder;

      await service.listResources({ limit: 10, offset: 5 });

      // When offset is provided, range is used instead of limit
      expect(builder.range).toHaveBeenCalledWith(5, 14);
    });

    it('returns empty array when no data', async () => {
      mockDb['reading_resources'] = makeBuilder({ data: null, error: null });

      const result = await service.listResources({});

      expect(result).toEqual([]);
    });

    it('throws if query fails', async () => {
      mockDb['reading_resources'] = makeBuilder({
        data: null,
        error: { message: 'db error' },
      });

      await expect(service.listResources({})).rejects.toMatchObject({
        message: 'db error',
      });
    });
  });

  /* ------------------------------------------------------------------ */
  /*  deleteResource                                                    */
  /* ------------------------------------------------------------------ */

  describe('deleteResource', () => {
    it('deletes a resource and emits event', async () => {
      mockDb['reading_resources'] = makeBuilder({ error: null });

      await service.deleteResource('res-1');

      expect(mockDb['reading_resources'].delete).toHaveBeenCalled();
      expect(mockDb['reading_resources'].eq).toHaveBeenCalledWith(
        'id',
        'res-1',
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'reading.resource_mutated',
      );
    });

    it('throws on database error', async () => {
      mockDb['reading_resources'] = makeBuilder({
        error: { message: 'db error' },
      });

      await expect(service.deleteResource('res-1')).rejects.toMatchObject({
        message: 'db error',
      });
    });
  });

  /* ------------------------------------------------------------------ */
  /*  tokenise                                                          */
  /* ------------------------------------------------------------------ */

  describe('tokenise', () => {
    it('returns cached token breakdown when available', async () => {
      const cached = {
        resourceId: 'res-1',
        language: 'en',
        totalTokens: 5,
        uniqueTokens: 4,
        tokens: [],
      };
      mockCacheService.get.mockResolvedValue(cached);

      const result = await service.tokenise('user-1', 'res-1', 'en');

      expect(result).toEqual(cached);
    });

    it('tokenises using Intl.Segmenter on cache miss', async () => {
      mockCacheService.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockDb['reading_resources'] = makeBuilder({
        data: {
          id: 'res-1',
          title: 'T',
          content: 'Hello world. How are you?',
          language: 'en',
          created_by: 'u1',
          created_at: '',
          updated_at: '',
        },
        error: null,
      });

      const result = await service.tokenise('user-1', 'res-1');

      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.language).toBe('en');
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('falls back to en locale when language is not provided', async () => {
      mockCacheService.get.mockResolvedValueOnce(null);
      mockDb['reading_resources'] = makeBuilder({
        data: {
          id: 'res-1',
          title: 'T',
          content: 'Hello.',
          language: null,
          created_by: 'u1',
          created_at: '',
          updated_at: '',
        },
        error: null,
      });

      const result = await service.tokenise('user-1', 'res-1');

      expect(result.language).toBe('en');
    });

    it('uses the lang query parameter override', async () => {
      mockCacheService.get.mockResolvedValueOnce(null);
      mockDb['reading_resources'] = makeBuilder({
        data: {
          id: 'res-1',
          title: 'T',
          content: 'Bonjour le monde',
          language: 'en',
          created_by: 'u1',
          created_at: '',
          updated_at: '',
        },
        error: null,
      });

      const result = await service.tokenise('user-1', 'res-1', 'fr');

      expect(result.language).toBe('fr');
    });

    it('calculates unique token count correctly', async () => {
      mockCacheService.get.mockResolvedValueOnce(null);
      mockDb['reading_resources'] = makeBuilder({
        data: {
          id: 'res-1',
          title: 'T',
          content: 'hello hello hello world',
          language: 'en',
          created_by: 'u1',
          created_at: '',
          updated_at: '',
        },
        error: null,
      });

      const result = await service.tokenise('user-1', 'res-1');

      expect(result.uniqueTokens).toBe(2); // 'hello' and 'world'
      expect(result.totalTokens).toBe(4);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  getProgress                                                       */
  /* ------------------------------------------------------------------ */

  describe('getProgress', () => {
    it('returns cached progress when available', async () => {
      const cached = {
        userId: 'u1',
        wordsRead: 100,
        articlesCompleted: 5,
        totalReadingTimeSeconds: 300,
        fluencyPercentage: 75,
      };
      mockCacheService.get.mockResolvedValue(cached);

      const result = await service.getProgress('u1');

      expect(result).toEqual(cached);
    });

    it('returns mapped progress from database on cache miss', async () => {
      const row: ReadingProgressRow = {
        user_id: 'u1',
        words_read: 50,
        articles_completed: 3,
        total_reading_time_seconds: 120,
        fluency_percentage: 60,
        updated_at: '2026-01-01T00:00:00Z',
        last_read_at: '2026-01-01T00:00:00Z',
      };
      mockDb['reading_progress'] = makeBuilder({ data: row, error: null });

      const result = await service.getProgress('u1');

      expect(result.wordsRead).toBe(50);
      expect(result.articlesCompleted).toBe(3);
      expect(result.totalReadingTimeSeconds).toBe(120);
      expect(result.fluencyPercentage).toBe(60);
      expect(result.lastReadAt).toBe('2026-01-01T00:00:00Z');
    });

    it('returns default zeros when no progress row exists (PGRST116)', async () => {
      mockDb['reading_progress'] = makeBuilder({
        data: null,
        error: { code: 'PGRST116', message: 'no rows' },
      });

      const result = await service.getProgress('u1');

      expect(result.wordsRead).toBe(0);
      expect(result.articlesCompleted).toBe(0);
      expect(result.totalReadingTimeSeconds).toBe(0);
      expect(result.fluencyPercentage).toBe(0);
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('throws if a non-PGRST116 error occurs', async () => {
      mockDb['reading_progress'] = makeBuilder({
        data: null,
        error: { code: 'XXXXX', message: 'fatal' },
      });

      await expect(service.getProgress('u1')).rejects.toMatchObject({
        message: 'fatal',
      });
    });
  });

  /* ------------------------------------------------------------------ */
  /*  recordSession                                                     */
  /* ------------------------------------------------------------------ */

  describe('recordSession', () => {
    it('calls the upsert_reading_progress RPC and emits event', async () => {
      (service as any).supabaseService.getClient = vi.fn().mockReturnValue({
        rpc: vi.fn().mockResolvedValue({ data: {}, error: null }),
        from: vi.fn().mockReturnValue(
          makeBuilder({
            data: {
              user_id: 'u1',
              words_read: 200,
              articles_completed: 6,
              total_reading_time_seconds: 400,
              fluency_percentage: 80,
              updated_at: '',
              last_read_at: '',
            },
            error: null,
          }),
        ),
      });

      await service.recordSession('u1', {
        resourceId: 'res-1',
        wordsRead: 50,
        durationSeconds: 120,
      });

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'reading.reading_completed',
        { userId: 'u1' },
      );
    });

    it('throws on RPC error', async () => {
      (service as any).supabaseService.getClient = vi.fn().mockReturnValue({
        rpc: vi
          .fn()
          .mockResolvedValue({ data: null, error: { message: 'rpc error' } }),
      });

      await expect(
        service.recordSession('u1', {
          resourceId: 'res-1',
          wordsRead: 50,
          durationSeconds: 120,
        }),
      ).rejects.toMatchObject({ message: 'rpc error' });
    });

    it('caches updated progress after recording session', async () => {
      const progressRow = {
        user_id: 'u1',
        words_read: 200,
        articles_completed: 6,
        total_reading_time_seconds: 400,
        fluency_percentage: 80,
        updated_at: '',
        last_read_at: '',
      };
      (service as any).supabaseService.getClient = vi.fn().mockReturnValue({
        rpc: vi.fn().mockResolvedValue({ data: {}, error: null }),
        from: vi
          .fn()
          .mockReturnValue(makeBuilder({ data: progressRow, error: null })),
      });

      await service.recordSession('u1', {
        resourceId: 'res-1',
        wordsRead: 50,
        durationSeconds: 120,
      });

      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  getCachedTranslation / cacheTranslation                           */
  /* ------------------------------------------------------------------ */

  describe('translation caching', () => {
    it('getCachedTranslation returns string when cached', async () => {
      mockCacheService.get.mockResolvedValue('Bonjour le monde');

      const result = await service.getCachedTranslation(
        'u1',
        'Hello world',
        'fr',
      );

      expect(result).toBe('Bonjour le monde');
    });

    it('getCachedTranslation returns null on miss', async () => {
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.getCachedTranslation(
        'u1',
        'Hello world',
        'fr',
      );

      expect(result).toBeNull();
    });

    it('cacheTranslation writes and emits event', async () => {
      await service.cacheTranslation('u1', 'Hello', 'fr', 'Bonjour');

      expect(mockCacheService.set).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'reading.translation_requested',
        { userId: 'u1' },
      );
    });

    it('translation keys include a truncated base64 of the source text', async () => {
      await service.cacheTranslation(
        'u1',
        'Hello world',
        'fr',
        'Bonjour le monde',
      );

      const setCallArgs = mockCacheService.set.mock.calls[0];
      expect(setCallArgs[0]).toContain('reading:translation:user:u1:fr:');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  clearUserCaches                                                   */
  /* ------------------------------------------------------------------ */

  describe('clearUserCaches', () => {
    it('emits user_data_cleared event', async () => {
      await service.clearUserCaches('u1');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'reading.user_data_cleared',
        { userId: 'u1' },
      );
    });
  });
});
