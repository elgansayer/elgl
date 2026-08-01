import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from './supabase.service';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('ioredis');

describe('SupabaseService', () => {
  let service: SupabaseService;
  let mockSupabaseClient: any;
  let mockRedisInstance: any;

  const buildConfigService = (
    overrides: Record<string, string | undefined> = {},
  ): ConfigService => {
    const values: Record<string, string | undefined> = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      REDIS_URL: 'redis://localhost:6379',
      ...overrides,
    };
    return {
      get: jest.fn((key: string) => values[key] ?? null),
    } as unknown as ConfigService;
  };

  const createService = async (
    configService: ConfigService,
  ): Promise<SupabaseService> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    return module.get<SupabaseService>(SupabaseService);
  };

  beforeEach(async () => {
    mockSupabaseClient = {
      from: jest.fn(),
      auth: { getUser: jest.fn() },
    };
    (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);

    mockRedisInstance = {
      on: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    };
    (Redis as unknown as jest.Mock).mockImplementation(() => mockRedisInstance);

    service = await createService(buildConfigService());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialisation', () => {
    it('should initialise supabase and redis clients successfully', () => {
      expect(createClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-service-key',
      );
      expect(Redis).toHaveBeenCalledWith('redis://localhost:6379', {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      expect(mockRedisInstance.on).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
      );
      expect(service.getClient()).toBe(mockSupabaseClient);
      expect(service.getRedisClient()).toBe(mockRedisInstance);
    });

    it('should use default redis URL if REDIS_URL is not provided', async () => {
      await createService(buildConfigService({ REDIS_URL: undefined }));

      expect(Redis).toHaveBeenCalledWith('redis://localhost:6379', {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
    });

    it('should throw an error if SUPABASE_URL is missing', async () => {
      await expect(
        createService(buildConfigService({ SUPABASE_URL: undefined })),
      ).rejects.toThrow(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
      );
    });

    it('should throw an error if SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
      await expect(
        createService(
          buildConfigService({ SUPABASE_SERVICE_ROLE_KEY: undefined }),
        ),
      ).rejects.toThrow(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
      );
    });

    it('should log redis error when error event is emitted', () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const errorCallback = mockRedisInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'error',
      )[1];

      expect(errorCallback).toBeDefined();
      errorCallback(new Error('Redis connection failed'));
      expect(consoleSpy).toHaveBeenCalledWith(
        'Redis connection error in SupabaseService:',
        'Redis connection failed',
      );
      consoleSpy.mockRestore();
    });
  });

  describe('getClient and getRedisClient', () => {
    it('should return initialised supabase and redis clients', () => {
      expect(service.getClient()).toBe(mockSupabaseClient);
      expect(service.getRedisClient()).toBe(mockRedisInstance);
    });
  });
});
describe('SupabaseService - Methods', () => {
  describe('updateLastActivity', () => {
    it('should update last_active_at and is_serious_learner', async () => {
      const mockUserId = 'user123';
      const mockData = { study_streak_days: 10, correction_ratio: 0.85 };
      const mockUpdateResponse = { error: null };

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            single: jest
              .fn()
              .mockResolvedValueOnce({ data: mockData, error: null }),
          }),
        }),
      });
      mockSupabaseClient.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce(mockUpdateResponse),
        }),
      });

      await service.updateLastActivity(mockUserId);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith(
        'study_streak_days, correction_ratio',
      );
      expect(mockSupabaseClient.from().select().eq).toHaveBeenCalledWith(
        'id',
        mockUserId,
      );
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith({
        last_active_at: expect.any(String),
        is_serious_learner: true,
      });
    });

    it('should log an error if fetching user data fails', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const mockUserId = 'user123';

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            single: jest.fn().mockResolvedValueOnce({
              data: null,
              error: { message: 'Fetch error' },
            }),
          }),
        }),
      });

      await service.updateLastActivity(mockUserId);

      expect(consoleSpy).toHaveBeenCalledWith(
        `Failed to fetch user data for userId ${mockUserId}:`,
        'Fetch error',
      );
      consoleSpy.mockRestore();
    });
  });

  describe('incrementXp', () => {
    it('should call the increment_xp function', async () => {
      const mockUserId = 'user123';
      const mockPoints = 50;

      mockSupabaseClient.rpc.mockResolvedValueOnce({ error: null });

      await service.incrementXp(mockUserId, mockPoints);

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('increment_xp', {
        user_id: mockUserId,
        amount: mockPoints,
      });
    });

    it('should fallback to manual XP update if increment_xp fails', async () => {
      const mockUserId = 'user123';
      const mockPoints = 50;
      const mockData = { xp_total: 100 };

      mockSupabaseClient.rpc.mockResolvedValueOnce({
        error: { message: 'RPC error' },
      });
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            single: jest
              .fn()
              .mockResolvedValueOnce({ data: mockData, error: null }),
          }),
        }),
      });
      mockSupabaseClient.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockResolvedValueOnce({ error: null }),
        }),
      });

      await service.incrementXp(mockUserId, mockPoints);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith('xp_total');
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith({
        xp_total: 150,
      });
    });

    it('should log an error if both RPC and manual update fail', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const mockUserId = 'user123';
      const mockPoints = 50;

      mockSupabaseClient.rpc.mockResolvedValueOnce({
        error: { message: 'RPC error' },
      });
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            single: jest.fn().mockResolvedValueOnce({
              data: null,
              error: { message: 'Fetch error' },
            }),
          }),
        }),
      });

      await service.incrementXp(mockUserId, mockPoints);

      expect(consoleSpy).toHaveBeenCalledWith(
        `Failed to increment XP for user ${mockUserId}:`,
        'RPC error',
      );
      consoleSpy.mockRestore();
    });
  });

  describe('getUserXp', () => {
    it('should return the user XP', async () => {
      const mockUserId = 'user123';
      const mockData = { xp_total: 200 };

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            single: jest
              .fn()
              .mockResolvedValueOnce({ data: mockData, error: null }),
          }),
        }),
      });

      const result = await service.getUserXp(mockUserId);

      expect(result).toBe(200);
    });

    it('should return 0 if fetching XP fails', async () => {
      const mockUserId = 'user123';

      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            single: jest.fn().mockResolvedValueOnce({
              data: null,
              error: { message: 'Fetch error' },
            }),
          }),
        }),
      });

      const result = await service.getUserXp(mockUserId);

      expect(result).toBe(0);
    });
  });
});
