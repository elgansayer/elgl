import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrivacyService } from './privacy.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyCacheInvalidationService } from '../safety/safety-cache-invalidation.service';
import { DeleteAccountDto } from './dto/delete-account.dto';

vi.mock('../economy/sanitise-economy.helper', () => ({
  scrubCoinPurchasesForArchive: vi.fn((records: unknown[]) => records),
  scrubEscrowTransactionsForArchive: vi.fn((records: unknown[]) => records),
}));

interface QueryResult {
  data: unknown;
  error: { message?: string; code?: string } | null;
}

describe('PrivacyService', () => {
  let service: PrivacyService;
  const mockFrom = vi.fn();
  const mockUpload = vi.fn();
  const mockCreateSignedUrl = vi.fn();
  const mockRemove = vi.fn();
  const mockInvalidateUserCaches = vi.fn();
  const tableRows = new Map<string, unknown[]>();
  const queryErrors = new Map<string, { message: string }>();
  const updates: Array<{ table: string; value: Record<string, unknown> }> = [];
  const inserts: Array<{ table: string; value: Record<string, unknown> }> = [];
  const ranges: Array<{ table: string; from: number; to: number }> = [];
  let latestArchive: Record<string, unknown> | null;

  function makeQuery(table: string): Record<string, unknown> {
    let operation: 'select' | 'update' | 'insert' = 'select';
    let updateValue: Record<string, unknown> | undefined;
    let insertValue: Record<string, unknown> | undefined;

    const resolveResult = (): QueryResult => {
      const error = queryErrors.get(table) ?? null;
      if (operation === 'update' && updateValue) {
        updates.push({ table, value: updateValue });
      }
      if (operation === 'insert' && insertValue) {
        inserts.push({ table, value: insertValue });
      }
      return { data: tableRows.get(table) ?? [], error };
    };

    const query: Record<string, unknown> & PromiseLike<QueryResult> = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      lte: vi.fn(() => query),
      in: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      insert: vi.fn((value: Record<string, unknown>) => {
        operation = 'insert';
        insertValue = value;
        return query;
      }),
      update: vi.fn((value: Record<string, unknown>) => {
        operation = 'update';
        updateValue = value;
        return query;
      }),
      range: vi.fn(async (from: number, to: number) => {
        ranges.push({ table, from, to });
        const error = queryErrors.get(table) ?? null;
        const rows = tableRows.get(table) ?? [];
        return { data: rows.slice(from, to + 1), error };
      }),
      single: vi.fn(async () => ({
        data: table === 'users' ? { id: 'user-1' } : null,
        error: queryErrors.get(table) ?? null,
      })),
      maybeSingle: vi.fn(async () => ({
        data:
          table === 'archive_requests'
            ? latestArchive
            : table === 'reading_progress'
              ? null
              : null,
        error: queryErrors.get(table) ?? null,
      })),
      then: (resolve, reject) => Promise.resolve(resolveResult()).then(resolve, reject),
    };

    return query;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    tableRows.clear();
    queryErrors.clear();
    updates.length = 0;
    inserts.length = 0;
    ranges.length = 0;
    latestArchive = null;

    mockFrom.mockImplementation((table: string) => makeQuery(table));
    mockUpload.mockResolvedValue({ error: null });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.example/signed/archive?token=short' },
      error: null,
    });
    mockRemove.mockResolvedValue({ error: null });
    mockInvalidateUserCaches.mockResolvedValue(undefined);

    const mockSupabaseClient = {
      from: mockFrom,
      storage: {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          createSignedUrl: mockCreateSignedUrl,
          remove: mockRemove,
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrivacyService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => mockSupabaseClient },
        },
        {
          provide: ConfigService,
          useValue: { get: vi.fn() },
        },
        {
          provide: SafetyCacheInvalidationService,
          useValue: { invalidateUserCaches: mockInvalidateUserCaches },
        },
      ],
    }).compile();

    service = module.get<PrivacyService>(PrivacyService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestArchive', () => {
    it('uploads to a private opaque object key and returns only a short-lived signed URL', async () => {
      const result = await service.requestArchive('user-1', {
        receipt_id: null,
        app_store: null,
      });

      expect(result.status).toBe('ready');
      expect(result.download_url).toContain('/signed/archive?token=short');
      expect(mockUpload).toHaveBeenCalledTimes(1);
      expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1);
      const [objectKey, json, options] = mockUpload.mock.calls[0];
      expect(objectKey).toMatch(/^[0-9a-f-]{36}\.json$/);
      expect(objectKey).not.toContain('user-1');
      expect(options).toMatchObject({
        contentType: 'application/json',
        upsert: false,
      });
      expect(JSON.parse(json)).toMatchObject({
        export_schema_version: 2,
        user_profile: { id: 'user-1' },
      });

      const requestInsert = inserts.find(
        (entry) => entry.table === 'archive_requests',
      );
      expect(requestInsert?.value.archive_url).toBeNull();
      expect(requestInsert?.value.status).toBe('processing');
      expect(requestInsert?.value.object_key).toBeNull();
      expect(updates).toContainEqual(
        expect.objectContaining({
          table: 'archive_requests',
          value: expect.objectContaining({
            status: 'ready',
            archive_url: null,
          }),
        }),
      );
    });

    it('reuses an unexpired ready archive without rebuilding private data', async () => {
      latestArchive = {
        id: '11111111-1111-4111-8111-111111111111',
        user_id: 'user-1',
        status: 'ready',
        object_key: 'opaque.json',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        created_at: new Date().toISOString(),
      };

      const result = await service.requestArchive('user-1', {
        receipt_id: null,
        app_store: null,
      });

      expect(result.status).toBe('ready');
      expect(mockUpload).not.toHaveBeenCalled();
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('opaque.json', 300);
    });

    it('returns processing for an idempotent concurrent request', async () => {
      latestArchive = {
        id: '22222222-2222-4222-8222-222222222222',
        user_id: 'user-1',
        status: 'processing',
        object_key: null,
        expires_at: null,
        created_at: new Date().toISOString(),
      };

      await expect(
        service.requestArchive('user-1', {
          receipt_id: null,
          app_store: null,
        }),
      ).resolves.toEqual({
        request_id: '22222222-2222-4222-8222-222222222222',
        status: 'processing',
      });
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('fails the whole archive when any exported dataset cannot be read', async () => {
      queryErrors.set('chat_messages', { message: 'provider detail' });

      await expect(
        service.requestArchive('user-1', {
          receipt_id: null,
          app_store: null,
        }),
      ).rejects.toThrow(ServiceUnavailableException);

      expect(mockUpload).not.toHaveBeenCalled();
      expect(updates).toContainEqual(
        expect.objectContaining({
          table: 'archive_requests',
          value: expect.objectContaining({
            status: 'failed',
            failure_code: 'dataset_unavailable',
          }),
        }),
      );
    });

    it('removes an uploaded object when persistence of ready state fails', async () => {
      let archiveRequestCalls = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table !== 'archive_requests') return makeQuery(table);
        archiveRequestCalls += 1;
        const query = makeQuery(table) as Record<string, unknown> & {
          update: ReturnType<typeof vi.fn>;
        };
        if (archiveRequestCalls >= 3) {
          const originalUpdate = query.update;
          query.update = vi.fn((value: Record<string, unknown>) => {
            originalUpdate(value);
            queryErrors.set('archive_requests', { message: 'write failed' });
            return query;
          });
        }
        return query;
      });

      await expect(
        service.requestArchive('user-1', {
          receipt_id: null,
          app_store: null,
        }),
      ).rejects.toThrow(ServiceUnavailableException);

      expect(mockRemove).toHaveBeenCalledTimes(1);
    });

    it('paginates collection datasets rather than relying on provider row defaults', async () => {
      tableRows.set(
        'moments',
        Array.from({ length: 501 }, (_, index) => ({ id: `moment-${index}` })),
      );

      await service.requestArchive('user-1', {
        receipt_id: null,
        app_store: null,
      });

      const momentRanges = ranges.filter((entry) => entry.table === 'moments');
      expect(momentRanges).toEqual([
        { table: 'moments', from: 0, to: 499 },
        { table: 'moments', from: 500, to: 999 },
      ]);
    });
  });

  describe('archive retention', () => {
    it('removes expired objects and clears their object keys', async () => {
      tableRows.set('archive_requests', [
        {
          id: '33333333-3333-4333-8333-333333333333',
          user_id: 'user-1',
          status: 'ready',
          object_key: 'opaque.json',
          expires_at: '2026-08-01T00:00:00.000Z',
          created_at: '2026-07-25T00:00:00.000Z',
        },
      ]);

      await expect(service.purgeExpiredArchives()).resolves.toBe(1);
      expect(mockRemove).toHaveBeenCalledWith(['opaque.json']);
      expect(updates).toContainEqual(
        expect.objectContaining({
          value: expect.objectContaining({
            status: 'expired',
            object_key: null,
            archive_url: null,
          }),
        }),
      );
    });
  });

  describe('deleteAccount', () => {
    it('requires explicit confirmation', async () => {
      const dto: DeleteAccountDto = { confirm_delete: false };
      await expect(service.deleteAccount('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('scrubs location, hides discovery and schedules the 30-day grace period', async () => {
      await service.deleteAccount('user-1', { confirm_delete: true });

      const userUpdate = updates.find((entry) => entry.table === 'users');
      expect(userUpdate?.value).toMatchObject({
        is_deletion_pending: true,
        privacy_hide_from_search: true,
        location: null,
        mock_location: null,
        mock_country: null,
        mock_city: null,
      });
      const scheduled = new Date(
        String(userUpdate?.value.scheduled_for_deletion_at),
      ).getTime();
      const expected = Date.now() + 30 * 24 * 60 * 60 * 1000;
      expect(Math.abs(scheduled - expected)).toBeLessThan(5_000);
      expect(mockInvalidateUserCaches).toHaveBeenCalledWith('user-1');
    });

    it('fails closed when the deletion schedule cannot be persisted', async () => {
      queryErrors.set('users', { message: 'DB unavailable' });
      await expect(
        service.deleteAccount('user-1', { confirm_delete: true }),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(mockInvalidateUserCaches).not.toHaveBeenCalled();
    });
  });

  describe('cancelDeletion', () => {
    it('clears deletion state', async () => {
      await service.cancelDeletion('user-1');
      const userUpdate = updates.find((entry) => entry.table === 'users');
      expect(userUpdate?.value).toEqual({
        scheduled_for_deletion_at: null,
        deletion_requested_at: null,
        is_deletion_pending: false,
      });
    });
  });
});
