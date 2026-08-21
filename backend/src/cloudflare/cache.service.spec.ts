import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CloudflareCacheService } from './cache.service';

describe('CloudflareCacheService', () => {
  let service: CloudflareCacheService;
  let configService: ConfigService;
  let fetchMock: Mock;
  let loggerMock: {
    info: Mock;
    warn: Mock;
    debug: Mock;
    error: Mock;
  };

  beforeEach(async () => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    loggerMock = {
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloudflareCacheService,
        {
          provide: 'PinoLogger:CloudflareCacheService',
          useValue: loggerMock,
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              const config: Record<string, string> = {
                CLOUDFLARE_API_TOKEN: 'test-token',
                CLOUDFLARE_ZONE_ID: 'test-zone-id',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CloudflareCacheService>(CloudflareCacheService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('purgeByCacheTags', () => {
    it('should return false when no tags provided', async () => {
      await expect(service.purgeByCacheTags([])).resolves.toBe(false);
    });

    it('should return false when API token is not configured', async () => {
      (configService.get as Mock).mockImplementation((key: string) => {
        const config: Record<string, string> = {
          CLOUDFLARE_API_TOKEN: '',
          CLOUDFLARE_ZONE_ID: 'test-zone-id',
        };
        return config[key];
      });

      await expect(service.purgeByCacheTags(['tag1'])).resolves.toBe(false);
    });

    it('should return false when zone ID is not configured', async () => {
      (configService.get as Mock).mockImplementation((key: string) => {
        const config: Record<string, string> = {
          CLOUDFLARE_API_TOKEN: 'test-token',
          CLOUDFLARE_ZONE_ID: '',
        };
        return config[key];
      });

      await expect(service.purgeByCacheTags(['tag1'])).resolves.toBe(false);
    });

    it('should call Cloudflare API purge_cache endpoint with tags', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          result: { id: 'purge-123' },
        }),
      });

      await expect(
        service.purgeByCacheTags(['flashcards:user1', 'flashcards:due:user1']),
      ).resolves.toBe(true);

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/zones/test-zone-id/purge_cache',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
          body: JSON.stringify({
            tags: ['flashcards:user1', 'flashcards:due:user1'],
          }),
        }),
      );
    });

    it('should return false when API responds with an error', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          success: false,
          errors: [{ code: 'INVALID_TAG', message: 'Invalid cache tag' }],
        }),
      });

      await expect(service.purgeByCacheTags(['invalid'])).resolves.toBe(false);
    });

    it('should return false when fetch throws', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      await expect(service.purgeByCacheTags(['tag1'])).resolves.toBe(false);
    });
  });
});
