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
  let configService: ConfigService;
  let mockSupabaseClient: any;
  let mockRedisInstance: any;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
              if (key === 'SUPABASE_SERVICE_ROLE_KEY')
                return 'test-service-key';
              if (key === 'REDIS_URL') return 'redis://localhost:6379';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SupabaseService>(SupabaseService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialise supabase and redis clients successfully', () => {
      service.onModuleInit();

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

    it('should use default redis URL if REDIS_URL is not provided', () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'test-service-key';
        return undefined;
      });

      service.onModuleInit();

      expect(Redis).toHaveBeenCalledWith('redis://localhost:6379', {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
    });

    it('should throw an error if SUPABASE_URL is missing', () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'test-service-key';
        return undefined;
      });

      expect(() => service.onModuleInit()).toThrow(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
      );
    });

    it('should throw an error if SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
        return undefined;
      });

      expect(() => service.onModuleInit()).toThrow(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
      );
    });

    it('should log redis error when error event is emitted', () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      service.onModuleInit();

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
      service.onModuleInit();
      expect(service.getClient()).toBe(mockSupabaseClient);
      expect(service.getRedisClient()).toBe(mockRedisInstance);
    });
  });
});
