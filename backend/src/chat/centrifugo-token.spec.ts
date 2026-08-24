import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type { Mock } from 'vitest';
import { CentrifugoService } from './centrifugo.service';

vi.mock('jsonwebtoken', () => ({
  sign: vi.fn(),
}));

const mockRedis = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
  script: vi.fn().mockResolvedValue('a'.repeat(40)),
};

vi.mock('ioredis', () => ({
  __esModule: true,
  default: vi.fn(function () {
    return mockRedis;
  }),
  Redis: vi.fn(function () {
    return mockRedis;
  }),
}));

describe('Centrifugo connection token signing', () => {
  const createService = async (
    secret: string | undefined = 'test-secret',
    nodeEnv = 'test',
  ) => {
    const config = {
      get: vi.fn((key: string) => {
        if (key === 'CENTRIFUGO_URL') return 'http://localhost:8000';
        if (key === 'CENTRIFUGO_API_KEY') return 'test-api-key';
        if (key === 'CENTRIFUGO_SECRET') return secret;
        if (key === 'REDIS_URL') return 'redis://localhost:6379';
        if (key === 'NODE_ENV') return nodeEnv;
        return undefined;
      }),
    } as unknown as ConfigService;
    const logger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };
    const service = new CentrifugoService(config, logger as never);
    await service.onModuleInit();
    return { service, logger };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.connect.mockResolvedValue(undefined);
    mockRedis.script.mockResolvedValue('a'.repeat(40));
  });

  it('pins the connection JWT to HS256 and preserves the authenticated sub claim', async () => {
    (jwt.sign as Mock).mockReturnValue('signed-token');
    const { service } = await createService();
    const payload = {
      sub: 'user-123',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    await expect(service.signJwt(payload)).resolves.toBe('signed-token');
    expect(jwt.sign).toHaveBeenCalledWith(payload, 'test-secret', {
      algorithm: 'HS256',
    });
  });

  it('fails closed instead of signing with a blank runtime secret', async () => {
    const { service, logger } = await createService('   ');

    expect(() => service.signJwt({ sub: 'user-123' })).toThrow(
      'Centrifugo token signing is unavailable.',
    );
    expect(jwt.sign).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'Centrifugo token signing is unavailable.',
    );
  });

  it('rejects a whitespace-only signing secret during production startup', async () => {
    const config = {
      get: vi.fn((key: string) => {
        if (key === 'CENTRIFUGO_URL') return 'https://centrifugo.example.com';
        if (key === 'CENTRIFUGO_API_KEY') return 'test-api-key';
        if (key === 'CENTRIFUGO_SECRET') return '   ';
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      }),
    } as unknown as ConfigService;
    const logger = { error: vi.fn() };
    const service = new CentrifugoService(config, logger as never);

    await expect(service.onModuleInit()).rejects.toThrow(
      'CENTRIFUGO_SECRET must be configured in production',
    );
    expect(mockRedis.connect).not.toHaveBeenCalled();
    expect(jwt.sign).not.toHaveBeenCalled();
  });
});