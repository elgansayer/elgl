import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ReadingEngineCacheService } from './reading-engine-cache.service';
import { ReadingEngineCacheNamespace } from './interfaces/cache-rules.interface';

describe('ReadingEngineCacheService', () => {
  let service: ReadingEngineCacheService;
  let redis: {
    get: Mock;
    set: Mock;
    del: Mock;
    scan: Mock;
  };

  beforeEach(async () => {
    redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      scan: vi.fn().mockResolvedValue(['0', []]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadingEngineCacheService,
        { provide: 'REDIS_CLIENT', useValue: redis },
      ],
    }).compile();

    service = module.get(ReadingEngineCacheService);
  });

  afterEach(() => vi.clearAllMocks());

  /* ---- Key building ---- */

  it('builds a namespaced, user-scoped cache key', () => {
    const key = service.buildKey({
      namespace: ReadingEngineCacheNamespace.RESOURCE,
      userId: 'abc123',
      resourceId: 'res-1',
    });
    expect(key).toBe('reading:resource:user:abc123:res-1');
  });

  it('omits optional segments when absent', () => {
    const key = service.buildKey({
      namespace: ReadingEngineCacheNamespace.PROGRESS,
      userId: 'abc123',
    });
    expect(key).toBe('reading:progress:user:abc123');
  });

  it('appends extra discriminator when provided', () => {
    const key = service.buildKey({
      namespace: ReadingEngineCacheNamespace.SUGGESTION,
      userId: 'abc123',
      extra: 'fr',
    });
    expect(key).toBe('reading:suggestion:user:abc123:fr');
  });

  it('builds a user-wide scan pattern', () => {
    const pattern = service.buildUserPattern(
      ReadingEngineCacheNamespace.PROGRESS,
      'abc123',
    );
    expect(pattern).toBe('reading:progress:user:abc123:*');
  });

  /* ---- Get / Set / Delete ---- */

  it('returns a parsed value from cache', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ hello: 'world' }));
    const result = await service.get<{ hello: string }>(
      'reading:resource:user:abc123:res-1',
    );
    expect(result).toEqual({ hello: 'world' });
  });

  it('returns null on cache miss', async () => {
    const result = await service.get('missing:key');
    expect(result).toBeNull();
  });

  it('returns null on JSON parse failure', async () => {
    redis.get.mockResolvedValue('not-valid-json');
    const result = await service.get('reading:resource:user:abc123:res-1');
    expect(result).toBeNull();
  });

  it('writes a value with inferred TTL', async () => {
    await service.set('reading:resource:user:abc123:res-1', { a: 1 });
    expect(redis.set).toHaveBeenCalledWith(
      'reading:resource:user:abc123:res-1',
      JSON.stringify({ a: 1 }),
      'EX',
      300,
    );
  });

  it('writes a value with explicit TTL', async () => {
    await service.set('reading:resource:user:abc123:res-1', { a: 1 }, 60);
    expect(redis.set).toHaveBeenCalledWith(
      'reading:resource:user:abc123:res-1',
      JSON.stringify({ a: 1 }),
      'EX',
      60,
    );
  });

  it('deletes a single key', async () => {
    await service.delete('reading:resource:user:abc123:res-1');
    expect(redis.del).toHaveBeenCalledWith(
      'reading:resource:user:abc123:res-1',
    );
  });

  /* ---- Bulk pattern deletion ---- */

  it('deletes keys matching a pattern using SCAN', async () => {
    redis.scan
      .mockResolvedValueOnce(['3', ['k1', 'k2']])
      .mockResolvedValueOnce(['0', ['k3']]);
    redis.del.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

    const deleted = await service.deletePattern('reading:resource:*');
    expect(deleted).toBe(3);
    expect(redis.scan).toHaveBeenCalledTimes(2);
    expect(redis.del).toHaveBeenCalledWith('k1', 'k2');
    expect(redis.del).toHaveBeenCalledWith('k3');
  });

  it('returns 0 when no keys match the pattern', async () => {
    const deleted = await service.deletePattern('reading:resource:*');
    expect(deleted).toBe(0);
  });

  /* ---- Event-driven invalidation ---- */

  it('invalidates resource & token caches on resource_mutated', async () => {
    await service.handleResourceMutated();
    expect(redis.scan).toHaveBeenCalledTimes(2);
    // SCAN call args: cursor, "MATCH", pattern, "COUNT", count
    const calls = redis.scan.mock.calls;
    expect(calls[0]).toEqual([
      '0',
      'MATCH',
      'reading:resource:*',
      'COUNT',
      100,
    ]);
    expect(calls[1]).toEqual(['0', 'MATCH', 'reading:token:*', 'COUNT', 100]);
  });

  it('invalidates user suggestion cache on flashcard_mutated', async () => {
    await service.handleFlashcardMutated({ userId: 'u1' });
    expect(redis.scan).toHaveBeenCalledWith(
      '0',
      'MATCH',
      'reading:suggestion:user:u1:*',
      'COUNT',
      100,
    );
  });

  it('invalidates user progress cache on reading_completed', async () => {
    await service.handleReadingCompleted({ userId: 'u1' });
    expect(redis.scan).toHaveBeenCalledWith(
      '0',
      'MATCH',
      'reading:progress:user:u1:*',
      'COUNT',
      100,
    );
  });

  it('invalidates user translation cache on translation_requested', async () => {
    await service.handleTranslationRequested({ userId: 'u1' });
    expect(redis.scan).toHaveBeenCalledWith(
      '0',
      'MATCH',
      'reading:translation:user:u1:*',
      'COUNT',
      100,
    );
  });

  it('bulk-invalidates all user namespaces on user_data_cleared', async () => {
    await service.handleUserDataCleared({ userId: 'u1' });
    // 6 namespaces
    expect(redis.scan).toHaveBeenCalledTimes(6);
    // SCAN call args: cursor, "MATCH", pattern, "COUNT", count
    const patterns = redis.scan.mock.calls.map((c: string[][]) => c[2]);
    expect(patterns).toContain('reading:resource:user:u1:*');
    expect(patterns).toContain('reading:token:user:u1:*');
    expect(patterns).toContain('reading:suggestion:user:u1:*');
    expect(patterns).toContain('reading:progress:user:u1:*');
    expect(patterns).toContain('reading:translation:user:u1:*');
    expect(patterns).toContain('reading:session:user:u1:*');
  });

  /* ---- TTL inference ---- */

  it('infers correct TTL per namespace', () => {
    expect(service['inferTtl']('reading:resource:user:abc:1')).toBe(300);
    expect(service['inferTtl']('reading:translation:user:abc:fr:xxx')).toBe(
      3600,
    );
    expect(service['inferTtl']('reading:progress:user:abc')).toBe(60);
    expect(service['inferTtl']('reading:suggestion:user:abc:fr')).toBe(120);
    expect(service['inferTtl']('reading:session:user:abc')).toBe(1800);
    expect(service['inferTtl']('reading:token:user:abc:res:1:fr')).toBe(600);
  });

  it('returns safe default for unknown namespace', () => {
    expect(service['inferTtl']('unknown:key')).toBe(300);
  });
});
