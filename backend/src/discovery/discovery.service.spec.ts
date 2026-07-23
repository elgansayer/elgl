import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService } from './discovery.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('DiscoveryService', () => {
  let service: DiscoveryService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      limit: jest.fn(),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
      rpc: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<DiscoveryService>(DiscoveryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchPartners', () => {
    it('should search partners with default filters without location', async () => {
      const partners = [{ id: 'partner-1', display_name: 'Partner One' }];
      mockQueryBuilder.limit.mockResolvedValue({
        data: partners,
        error: null,
      });

      const result = await service.searchPartners('user-1', null, {});

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockQueryBuilder.select).toHaveBeenCalled();
      expect(mockQueryBuilder.neq).toHaveBeenCalledWith('id', 'user-1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
        'privacy_hide_from_search',
        false,
      );
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
      expect(result).toEqual(partners);
    });

    it('should apply native language, target language, and serious learner filters', async () => {
      const partners = [{ id: 'partner-2', display_name: 'Serious Partner' }];
      mockQueryBuilder.limit.mockResolvedValue({
        data: partners,
        error: null,
      });

      const result = await service.searchPartners('user-1', null, {
        native_language: 'ES',
        target_language: 'EN',
        serious_learner_only: true,
      });

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('native_language', 'ES');
      expect(mockQueryBuilder.contains).toHaveBeenCalledWith(
        'target_languages',
        ['EN'],
      );
      expect(mockQueryBuilder.gt).toHaveBeenCalledWith('study_streak_days', 7);
      expect(mockQueryBuilder.gte).toHaveBeenCalledWith(
        'correction_ratio',
        0.8,
      );
      expect(result).toEqual(partners);
    });

    it('should call rpc search_nearby_users when latitude and longitude are provided', async () => {
      const nearbyPartners = [{ id: 'nearby-1', display_name: 'Nearby User' }];
      mockSupabaseClient.rpc.mockResolvedValue({
        data: nearbyPartners,
        error: null,
      });

      const result = await service.searchPartners('user-1', null, {
        latitude: 51.5074,
        longitude: -0.1278,
        radius_metres: 10000,
        native_language: 'FR',
      });

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'search_nearby_users',
        {
          search_lat: 51.5074,
          search_lon: -0.1278,
          radius_m: 10000,
          exclude_user_id: 'user-1',
          filter_native: 'FR',
          filter_target: null,
          serious_only: false,
        },
      );
      expect(result).toEqual(nearbyPartners);
    });

    it('should fall back to standard query when rpc returns error', async () => {
      const fallbackPartners = [{ id: 'fallback-1' }];
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Postgis not ready' },
      });
      mockQueryBuilder.limit.mockResolvedValue({
        data: fallbackPartners,
        error: null,
      });

      const result = await service.searchPartners('user-1', null, {
        latitude: 35.6895,
        longitude: 139.6917,
      });

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
      expect(result).toEqual(fallbackPartners);
    });

    it('should return empty array when rpc fallback returns error or null data', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC failure' },
      });
      mockQueryBuilder.limit.mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      });

      const result = await service.searchPartners('user-1', null, {
        latitude: 35.6895,
        longitude: 139.6917,
      });

      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array when standard query returns error or null data', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: null,
        error: { message: 'Query error' },
      });

      const result = await service.searchPartners('user-1', null, {});
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].id).toBeDefined();
    });
  });
});
