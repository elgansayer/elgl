import type { Mock, MockInstance } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CentrifugoService } from './centrifugo.service';
import { PinoLogger } from 'nestjs-pino';
import * as jwt from 'jsonwebtoken';
import Redis from 'ioredis';

vi.mock('jsonwebtoken', () => ({
  sign: vi.fn(),
}));

const LUA_SHA_SEED = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';

// The single shared mock object. vi.mock is hoisted so its factory captures
// the *variable reference*, meaning we can mutate this object in beforeEach and
// the mock constructor will return the updated object.
const mockRedis: Record<string, Mock> = {};

vi.mock('ioredis', () => ({
  __esModule: true,
  default: vi.fn(function () {
    return mockRedis;
  }),
  Redis: vi.fn(function () {
    return mockRedis;
  }),
}));

describe('CentrifugoService', () => {
  let service: CentrifugoService;
  let configService: ConfigService;
  let mockLogger: {
    error: Mock;
    warn: Mock;
    info: Mock;
    debug: Mock;
  };

  beforeEach(async () => {
    // Rebuild the mock's properties without touching its identity.
    // This keeps vi.fn(() => mockRedis) intact while giving fresh vi
    // functions for call tracking every test.
    const entries: Array<[string, Mock]> = [
      ['multi', vi.fn()],
      ['connect', vi.fn().mockResolvedValue(undefined)],
      ['disconnect', vi.fn()],
      ['script', vi.fn().mockResolvedValue(LUA_SHA_SEED)],
      ['evalsha', vi.fn()],
      ['zadd', vi.fn()],
      ['expire', vi.fn()],
    ];
    // Remove stale keys
    Object.keys(mockRedis).forEach((k) => {
      if (
        k !== 'multi' &&
        k !== 'connect' &&
        k !== 'disconnect' &&
        k !== 'script' &&
        k !== 'evalsha' &&
        k !== 'zadd' &&
        k !== 'expire'
      )
        delete mockRedis[k];
    });
    entries.forEach(([k, v]) => {
      mockRedis[k] = v;
    });

    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CentrifugoService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              if (key === 'CENTRIFUGO_URL') return 'http://localhost:8000';
              if (key === 'CENTRIFUGO_API_KEY') return 'test-api-key';
              if (key === 'CENTRIFUGO_SECRET') return 'test-secret';
              if (key === 'REDIS_URL') return 'redis://localhost:6379';
              return null;
            }),
          },
        },
        {
          provide: `PinoLogger:${CentrifugoService.name}`,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<CentrifugoService>(CentrifugoService);
    configService = module.get<ConfigService>(ConfigService);
    await service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialise apiUrl, apiKey, and tokenSecret from config', () => {
      expect(configService.get).toHaveBeenCalledWith('CENTRIFUGO_URL');
      expect(configService.get).toHaveBeenCalledWith('CENTRIFUGO_API_KEY');
      expect(configService.get).toHaveBeenCalledWith('CENTRIFUGO_SECRET');
    });

    it('connects with the v5-compatible RESP2 protocol and loads the Lua script', () => {
      expect(Redis).toHaveBeenCalledWith('redis://localhost:6379', {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        enableOfflineQueue: false,
        protocol: 2,
      });
      expect(mockRedis.connect).toHaveBeenCalled();
      expect(mockRedis.script).toHaveBeenCalledWith('LOAD', expect.any(String));
    });
  });

  describe('checkConnectionRateLimit', () => {
    it('should return allowed=true when Redis is unavailable', async () => {
      (service as unknown as { redis: unknown }).redis = null;
      const result = await service.checkConnectionRateLimit('user-1');
      expect(result.allowed).toBe(true);
      expect(result.retryAfterMs).toBe(0);
    });

    it('should return allowed=true when under rate limit (Lua script)', async () => {
      mockRedis.evalsha.mockResolvedValue([1, 0]);
      const result = await service.checkConnectionRateLimit('user-1');
      expect(result.allowed).toBe(true);
      expect(result.retryAfterMs).toBe(0);
    });

    it('should return allowed=false with retryAfterMs when rate limit exceeded (Lua script)', async () => {
      mockRedis.evalsha.mockResolvedValue([0, 3500]);
      const result = await service.checkConnectionRateLimit('user-1');
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBe(3500);
    });

    it('should fall back to pipeline when Lua SHA is not loaded', async () => {
      (
        service as unknown as { slidingWindowLuaSha: string | null }
      ).slidingWindowLuaSha = null;
      const mockMulti = {
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 1],
          [null, 2],
        ]),
      };
      mockRedis.multi.mockReturnValue(mockMulti);
      mockRedis.zadd.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);
      const result = await service.checkConnectionRateLimit('user-1');
      expect(result.allowed).toBe(true);
      expect(mockRedis.multi).toHaveBeenCalled();
    });

    it('should fall back to pipeline and reject when limit exceeded', async () => {
      (
        service as unknown as { slidingWindowLuaSha: string | null }
      ).slidingWindowLuaSha = null;
      const mockMulti = {
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 1],
          [null, 5],
        ]),
      };
      mockRedis.multi.mockReturnValue(mockMulti);
      const result = await service.checkConnectionRateLimit('user-1');
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('should use IP as key when userId is empty', async () => {
      mockRedis.evalsha.mockResolvedValue([1, 0]);
      await service.checkConnectionRateLimit('', '192.168.1.1');
      expect(mockRedis.evalsha).toHaveBeenCalledWith(
        expect.any(String),
        1,
        'centrifugo:conn_rate:192.168.1.1',
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
      );
    });

    it('should allow when Redis throws an error', async () => {
      mockRedis.evalsha.mockRejectedValue(new Error('Redis down'));
      const result = await service.checkConnectionRateLimit('user-1');
      expect(result.allowed).toBe(true);
    });
  });

  describe('getRateWindowSec', () => {
    it('should return the configured rate window in seconds', () => {
      expect(service.getRateWindowSec()).toBe(60);
    });

    it('should respect CENTRIFUGO_CONNECTION_RATE_WINDOW_SEC', async () => {
      const mod = await Test.createTestingModule({
        providers: [
          CentrifugoService,
          {
            provide: ConfigService,
            useValue: {
              get: vi.fn((key: string) => {
                if (key === 'CENTRIFUGO_URL') return 'http://localhost:8000';
                if (key === 'CENTRIFUGO_API_KEY') return 'test-api-key';
                if (key === 'CENTRIFUGO_SECRET') return 'test-secret';
                if (key === 'REDIS_URL') return 'redis://localhost:6379';
                if (key === 'CENTRIFUGO_CONNECTION_RATE_WINDOW_SEC')
                  return '120';
                return null;
              }),
            },
          },
          {
            provide: `PinoLogger:${CentrifugoService.name}`,
            useValue: mockLogger,
          },
        ],
      }).compile();
      const srv = mod.get<CentrifugoService>(CentrifugoService);
      await srv.onModuleInit();
      expect(srv.getRateWindowSec()).toBe(120);
    });
  });

  describe('generateConnectionToken', () => {
    it('should generate a JWT connection token using secret', () => {
      (jwt.sign as Mock).mockReturnValue('mock-jwt-token');
      const result = service.generateConnectionToken('user-123');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-123', exp: expect.any(Number) }),
        'test-secret',
      );
      expect(result).toEqual({ token: 'mock-jwt-token' });
    });

    it('should set expiry to 24 hours in the future', () => {
      const now = Math.floor(Date.now() / 1000);
      const signMock = jwt.sign as Mock;
      signMock.mockClear();
      signMock.mockReturnValue('token');
      service.generateConnectionToken('user-abc');
      const payload = signMock.mock.calls[0][0] as { sub: string; exp: number };
      expect(payload.sub).toEqual('user-abc');
      expect(payload.exp).toBeGreaterThanOrEqual(now + 86400 - 5);
      expect(payload.exp).toBeLessThanOrEqual(now + 86400 + 5);
    });
  });

  describe('publish', () => {
    let fetchSpy: MockInstance;

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch');
    });

    afterEach(() => {
      fetchSpy?.mockRestore();
    });

    it('should publish data successfully and return true when response ok', async () => {
      fetchSpy.mockResolvedValue({ ok: true });
      const result = await service.publish('chat:room-1', { text: 'Hello' });
      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:8000/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'apikey test-api-key',
        },
        body: JSON.stringify({
          method: 'publish',
          params: { channel: 'chat:room-1', data: { text: 'Hello' } },
        }),
      });
      expect(result).toBe(true);
    });

    it('should return false when fetch response is not ok', async () => {
      fetchSpy.mockResolvedValue({ ok: false });
      const result = await service.publish('chat:room-1', { text: 'Hello' });
      expect(result).toBe(false);
    });

    it('should catch fetch error, log error, and return false', async () => {
      fetchSpy.mockRejectedValue(new Error('Network failure'));
      const result = await service.publish('chat:room-1', { text: 'Hello' });
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: 'Network failure', channel: 'chat:room-1' },
        'Centrifugo publish error',
      );
    });
  });

  describe('publishTranslated', () => {
    let publishSpy: MockInstance;

    beforeEach(() => {
      publishSpy = vi.spyOn(service, 'publish').mockResolvedValue(true);
    });

    afterEach(() => {
      publishSpy.mockRestore();
    });

    it('should include extraData and translation fields, and call publish', async () => {
      const extraData = { channel_type: 'voice_room' };
      const result = await service.publishTranslated(
        'chat:room-1',
        'Hello there',
        'es',
        extraData,
      );
      expect(publishSpy).toHaveBeenCalledWith('chat:room-1', {
        ...extraData,
        text_content: 'Hello there',
        original_text: 'Hello there',
        translated_text: 'Hello there',
        detected_language: 'en',
      });
      expect(result).toBe(true);
    });

    it('should return false when publish returns false', async () => {
      publishSpy.mockResolvedValue(false);
      const result = await service.publishTranslated(
        'chat:room-1',
        'Hello there',
        'es',
        {},
      );
      expect(result).toBe(false);
      expect(publishSpy).toHaveBeenCalledWith('chat:room-1', {
        text_content: 'Hello there',
        original_text: 'Hello there',
        translated_text: 'Hello there',
        detected_language: 'en',
      });
    });
  });
});
