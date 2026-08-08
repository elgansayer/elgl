import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CentrifugoService } from './centrifugo.service';
import { PinoLogger } from 'nestjs-pino';
import * as jwt from 'jsonwebtoken';
import Redis from 'ioredis';

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
}));

jest.mock('ioredis', () => {
  const mockRedis = {
    multi: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
  };
  return {
    default: jest.fn(() => mockRedis),
    Redis: jest.fn(() => mockRedis),
  };
});

describe('CentrifugoService', () => {
  let service: CentrifugoService;
  let configService: ConfigService;
  let redisInstance: jest.Mocked<Redis>;
  let mockLogger: {
    error: jest.Mock;
    warn: jest.Mock;
    info: jest.Mock;
    debug: jest.Mock;
  };

  beforeEach(async () => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CentrifugoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
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
    service.onModuleInit();
    redisInstance = (service as unknown as { redis: jest.Mocked<Redis> }).redis;
  });

  afterEach(() => {
    jest.clearAllMocks();
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
  });

  describe('checkConnectionRateLimit', () => {
    it('should return true when Redis is unavailable', async () => {
      // Simulate Redis not initialised
      const svc = service as unknown as { redis: Redis | null };
      svc.redis = null;

      const result = await service.checkConnectionRateLimit('user-1');
      expect(result).toBe(true);
    });

    it('should return true when under rate limit', async () => {
      const mockMulti = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 1],
          [null, 2], // 2 existing connections under limit of 5
        ]),
      };
      const mockZadd = jest.fn().mockResolvedValue('OK');
      const mockExpire = jest.fn().mockResolvedValue(1);

      const svc = service as unknown as {
        redis: { multi: jest.Mock; zadd: jest.Mock; expire: jest.Mock };
      };
      svc.redis = {
        multi: jest.fn(() => mockMulti),
        zadd: mockZadd,
        expire: mockExpire,
      };

      const result = await service.checkConnectionRateLimit('user-1');
      expect(result).toBe(true);
      expect(mockMulti.zremrangebyscore).toHaveBeenCalled();
      expect(mockMulti.zcard).toHaveBeenCalled();
      expect(mockZadd).toHaveBeenCalled();
    });

    it('should return false when rate limit exceeded', async () => {
      const mockMulti = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 1],
          [null, 5], // 5 connections = at limit
        ]),
      };

      const svc = service as unknown as {
        redis: { multi: jest.Mock };
      };
      svc.redis = {
        multi: jest.fn(() => mockMulti),
      };

      const result = await service.checkConnectionRateLimit('user-1');
      expect(result).toBe(false);
    });
  });

  describe('generateConnectionToken', () => {
    it('should generate a JWT connection token using secret', () => {
      (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');

      const result = service.generateConnectionToken('user-123');

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-123',
          exp: expect.any(Number),
        }),
        'test-secret',
      );
      expect(result).toEqual({ token: 'mock-jwt-token' });
    });

    it('should set expiry to 24 hours in the future', () => {
      const now = Math.floor(Date.now() / 1000);
      (jwt.sign as jest.Mock).mockReturnValue('token');
      service.generateConnectionToken('user-abc');
      const payload = (jwt.sign as jest.Mock).mock.calls[0][0] as {
        sub: string;
        exp: number;
      };
      expect(payload.sub).toEqual('user-abc');
      expect(payload.exp).toBeGreaterThanOrEqual(now + 86400 - 5);
      expect(payload.exp).toBeLessThanOrEqual(now + 86400 + 5);
    });
  });

  describe('publish', () => {
    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
      fetchSpy = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
      if (fetchSpy) {
        fetchSpy.mockRestore();
      }
    });

    it('should publish data successfully and return true when response ok', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
      });

      const result = await service.publish('chat:room-1', { text: 'Hello' });

      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:8000/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'apikey test-api-key',
        },
        body: JSON.stringify({
          method: 'publish',
          params: {
            channel: 'chat:room-1',
            data: { text: 'Hello' },
          },
        }),
      });
      expect(result).toBe(true);
    });

    it('should return false when fetch response is not ok', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
      });

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
    let publishSpy: jest.SpyInstance;

    beforeEach(() => {
      publishSpy = jest.spyOn(service, 'publish').mockResolvedValue(true);
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
