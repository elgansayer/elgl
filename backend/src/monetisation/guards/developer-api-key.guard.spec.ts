import type { Mock } from 'vitest';
import { createHash } from 'node:crypto';
import {
  ExecutionContext,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DeveloperApiKeyGuard } from './developer-api-key.guard';
import { SupabaseService } from '../../supabase/supabase.service';

interface MockRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: unknown;
  developerApiKeyAuthenticated?: boolean;
}

interface MockQueryBuilder {
  select: Mock;
  eq: Mock;
  single: Mock;
}

describe('DeveloperApiKeyGuard', () => {
  let guard: DeveloperApiKeyGuard;
  let query: MockQueryBuilder;
  let getClient: Mock;
  let getRedisClient: Mock;
  let redisIncr: Mock;
  let redisExpire: Mock;

  const rawKey = 'ht_dev_0123456789abcdef0123456789abcdef';
  const rawDigest = createHash('sha256').update(rawKey).digest('hex');

  beforeEach(async () => {
    query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'not found' } }),
    };
    getClient = vi
      .fn()
      .mockReturnValue({ from: vi.fn().mockReturnValue(query) });
    redisIncr = vi.fn().mockResolvedValue(1);
    redisExpire = vi.fn().mockResolvedValue(1);
    getRedisClient = vi.fn().mockReturnValue({
      incr: redisIncr,
      expire: redisExpire,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeveloperApiKeyGuard,
        {
          provide: SupabaseService,
          useValue: { getClient, getRedisClient },
        },
      ],
    }).compile();

    guard = module.get<DeveloperApiKeyGuard>(DeveloperApiKeyGuard);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function contextFor(request: MockRequest): ExecutionContext {
    return {
      getType: vi.fn().mockReturnValue('http'),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue(request),
      }),
    } as unknown as ExecutionContext;
  }

  it('ignores requests without an API key so JWT authentication can run', async () => {
    const request: MockRequest = { headers: {} };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(getClient).not.toHaveBeenCalled();
  });

  it('rejects a malformed key before any database lookup', async () => {
    const request: MockRequest = {
      headers: { authorization: 'Bearer ht_dev_bad' },
    };

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      new UnauthorizedException('Invalid developer API key'),
    );
    expect(getClient).not.toHaveBeenCalled();
  });

  it('rejects keys that do not match a stored digest', async () => {
    const request: MockRequest = {
      headers: { authorization: `Bearer ${rawKey}` },
    };

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      new UnauthorizedException('Invalid developer API key'),
    );
    expect(query.eq).toHaveBeenCalledWith('developer_api_key_hash', rawDigest);
  });

  it('rejects a key whose owner no longer has an active Developer subscription', async () => {
    query.single.mockResolvedValue({
      data: { id: 'user-1', is_vip: true, vip_tier: 'consumer' },
      error: null,
    });
    const request: MockRequest = { headers: { 'x-api-key': rawKey } };

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      new ForbiddenException('Developer subscription required'),
    );
  });

  it('authenticates a valid key and marks the request for JWT bypass', async () => {
    query.single.mockResolvedValue({
      data: { id: 'user-1', is_vip: true, vip_tier: 'developer_pro' },
      error: null,
    });
    const request: MockRequest = { headers: { 'x-api-key': rawKey } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(query.eq).toHaveBeenCalledWith('developer_api_key_hash', rawDigest);
    expect(request.developerApiKeyAuthenticated).toBe(true);
    expect(request.user).toMatchObject({ id: 'user-1' });
  });

  it('enforces the 600 RPM Developer limit', async () => {
    redisIncr.mockResolvedValue(601);
    const request: MockRequest = { headers: { 'x-api-key': rawKey } };

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(getClient).not.toHaveBeenCalled();
  });

  it('allows requests when Redis is unavailable rather than failing closed on the whole feature', async () => {
    redisIncr.mockRejectedValue(new Error('redis down'));
    query.single.mockResolvedValue({
      data: { id: 'user-1', is_vip: true, vip_tier: 'developer' },
      error: null,
    });
    const request: MockRequest = { headers: { 'x-api-key': rawKey } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
  });
});
