import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import * as jwt from 'jsonwebtoken';
import { SupabaseService } from '../supabase/supabase.service';
import { TransferService } from './transfer.service';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
const SECRET = 'transfer-session-test-secret';
const USER = 'transferring-user';

describe('TransferService session exchange', () => {
  let service: TransferService;
  const records = new Map<string, string>();
  const redis = {
    setex: vi.fn(async (key: string, _ttl: number, value: string) => {
      records.set(key, value);
      return 'OK';
    }),
    getdel: vi.fn(async (key: string) => {
      const value = records.get(key) ?? null;
      records.delete(key);
      return value;
    }),
  };
  const admin = { getUserById: vi.fn(), generateLink: vi.fn() };
  const sharedVerifyOtp = vi.fn();
  const verifyOtp = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    records.clear();
    admin.getUserById.mockResolvedValue({
      data: { user: { id: USER, email: 'user@example.test' } },
      error: null,
    });
    admin.generateLink.mockResolvedValue({
      data: {
        user: { id: USER },
        properties: {
          hashed_token: 'hashed-otp',
          verification_type: 'magiclink',
        },
      },
      error: null,
    });
    verifyOtp.mockResolvedValue({
      data: {
        session: {
          access_token: 'access',
          refresh_token: 'refresh',
          user: { id: USER },
        },
      },
      error: null,
    });
    vi.mocked(createClient).mockReturnValue({
      auth: { verifyOtp },
    } as unknown as ReturnType<typeof createClient>);
    const config: Record<string, string> = {
      TRANSFER_SECRET: SECRET,
      NODE_ENV: 'test',
      SUPABASE_URL: 'https://auth.example.test',
      SUPABASE_SERVICE_ROLE_KEY: 'server-key',
    };
    const module = await Test.createTestingModule({
      providers: [
        TransferService,
        {
          provide: SupabaseService,
          useValue: {
            getRedisClient: () => redis,
            getClient: () => ({ auth: { admin, verifyOtp: sharedVerifyOtp } }),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => config[key] },
        },
      ],
    }).compile();
    service = module.get(TransferService);
  });

  afterEach(() => vi.restoreAllMocks());

  async function swapToken() {
    const token = await service.generateTransferToken(USER);
    return (await service.consumeTransferToken(token))!;
  }

  it('expires the transfer after five minutes and consumes it atomically', async () => {
    const token = await service.generateTransferToken(USER);
    expect(redis.setex).toHaveBeenCalledWith(`transfer:${token}`, 300, USER);
    const results = await Promise.all([
      service.consumeTransferToken(token),
      service.consumeTransferToken(token),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const payload = jwt.verify(
      results.find(Boolean)!,
      SECRET,
    ) as jwt.JwtPayload;
    expect(payload.sub).toBe(USER);
    expect(payload.exp! - payload.iat!).toBe(60);
    expect(redis.setex).toHaveBeenCalledWith(
      `transfer-swap:${payload.jti}`,
      60,
      USER,
    );
  });

  it('uses the generated hash and an isolated client to return a matching session', async () => {
    await expect(
      service.swapTokenForSession(await swapToken()),
    ).resolves.toEqual({
      access_token: 'access',
      refresh_token: 'refresh',
      user_id: USER,
    });
    expect(createClient).toHaveBeenCalledWith(
      'https://auth.example.test',
      'server-key',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: 'hashed-otp',
      type: 'magiclink',
    });
    expect(sharedVerifyOtp).not.toHaveBeenCalled();
  });

  it('allows at most one concurrent swap and rejects later replay', async () => {
    const token = await swapToken();
    const results = await Promise.all([
      service.swapTokenForSession(token),
      service.swapTokenForSession(token),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    await expect(service.swapTokenForSession(token)).resolves.toBeNull();
    expect(admin.generateLink).toHaveBeenCalledTimes(1);
  });

  it.each([
    jwt.sign({ sub: USER, type: 'device-transfer', jti: 'j' }, SECRET, {
      expiresIn: -1,
    }),
    jwt.sign(
      { sub: USER, type: 'device-transfer', jti: 'j' },
      'incorrect-secret',
      { expiresIn: 60 },
    ),
    jwt.sign({ sub: USER, type: 'device-transfer', jti: 'j' }, SECRET, {
      expiresIn: 60,
      algorithm: 'HS384',
    }),
    jwt.sign({ sub: USER, type: 'device-transfer' }, SECRET, { expiresIn: 60 }),
    jwt.sign({ sub: USER, type: 'device-transfer', jti: 'j' }, SECRET),
    jwt.sign({ sub: USER, type: 'different-purpose', jti: 'j' }, SECRET, {
      expiresIn: 60,
    }),
    'malformed-token',
  ])('rejects an invalid or incorrectly scoped JWT (%#)', async (token) => {
    await expect(service.swapTokenForSession(token)).resolves.toBeNull();
    expect(admin.getUserById).not.toHaveBeenCalled();
    expect(redis.getdel).not.toHaveBeenCalled();
  });

  it('fails closed when the receipt belongs to another user', async () => {
    records.set('transfer-swap:wrong-user', 'someone-else');
    const token = jwt.sign(
      { sub: USER, type: 'device-transfer', jti: 'wrong-user' },
      SECRET,
      { expiresIn: 60 },
    );
    await expect(service.swapTokenForSession(token)).resolves.toBeNull();
    expect(admin.getUserById).not.toHaveBeenCalled();
  });

  it('fails closed on Redis failure without exposing credentials', async () => {
    const token = await swapToken();
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    redis.getdel.mockRejectedValueOnce(new Error('secret credential details'));
    await expect(service.swapTokenForSession(token)).resolves.toBeNull();
    expect(admin.getUserById).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      'Device transfer session exchange failed',
    );
  });

  it('does not exchange a link for another account', async () => {
    admin.generateLink.mockResolvedValueOnce({
      data: {
        user: { id: 'other-user' },
        properties: { hashed_token: 'hash', verification_type: 'magiclink' },
      },
      error: null,
    });
    await expect(
      service.swapTokenForSession(await swapToken()),
    ).resolves.toBeNull();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('rejects a session belonging to another account', async () => {
    verifyOtp.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'access',
          refresh_token: 'refresh',
          user: { id: 'other-user' },
        },
      },
      error: null,
    });
    await expect(
      service.swapTokenForSession(await swapToken()),
    ).resolves.toBeNull();
  });

  it('keeps failed provider exchanges consumed', async () => {
    const token = await swapToken();
    verifyOtp.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'sensitive provider details' },
    });
    await expect(service.swapTokenForSession(token)).resolves.toBeNull();
    await expect(service.swapTokenForSession(token)).resolves.toBeNull();
    expect(verifyOtp).toHaveBeenCalledTimes(1);
  });
});
