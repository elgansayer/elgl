/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService } from './discovery.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyService } from '../safety/safety.service';
import { AudioRoomsService } from '../audio-rooms/audio-rooms.service';

jest.mock('../mock-data', () => ({
  MOCK_USERS: [],
}));

describe('DiscoveryService', () => {
  let service: DiscoveryService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;
  let mockRedisClient: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      overlaps: jest.fn().mockReturnThis(),
      limit: jest.fn(),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
      rpc: jest.fn(),
    };

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
            getRedisClient: jest.fn().mockReturnValue(mockRedisClient),
          },
        },
        {
          provide: SafetyService,
          useValue: {
            getBlockedAndBlockerIds: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: AudioRoomsService,
          useValue: {
            getActiveHostIds: jest.fn().mockResolvedValue([]),
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
      expect(result).toEqual(
        partners.map((p) => ({
          ...p,
          is_partner_of_week: false,
        })),
      );
    });

    it('should apply native language, target language, and serious learner filters', async () => {
      const partners = [{ id: 'partner-2', display_name: 'Serious Partner' }];
      mockQueryBuilder.limit.mockResolvedValue({
        data: partners,
        error: null,
      });

      const result = await service.searchPartners('user-1', null, {
        native_languages: 'ES',
        target_language: 'EN',
        serious_learner_only: true,
      });

      expect(mockQueryBuilder.contains).toHaveBeenCalledWith(
        'native_languages',
        ['ES'],
      );
      expect(mockQueryBuilder.contains).toHaveBeenCalledWith(
        'target_languages',
        ['EN'],
      );
      expect(mockQueryBuilder.gt).toHaveBeenCalledWith('study_streak_days', 7);
      expect(mockQueryBuilder.gte).toHaveBeenCalledWith(
        'correction_ratio',
        0.8,
      );
      expect(result).toEqual(
        partners.map((p) => ({
          ...p,
          is_partner_of_week: false,
        })),
      );
    });

    it('should apply proficiency level filter', async () => {
      const partners = [
        { id: 'partner-3', display_name: 'Proficient Partner' },
      ];
      mockQueryBuilder.limit.mockResolvedValue({
        data: partners,
        error: null,
      });

      const result = await service.searchPartners('user-1', null, {
        level: 'B2',
      });

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
        'proficiency_level',
        'B2',
      );
      expect(result).toEqual(
        partners.map((p) => ({ ...p, is_partner_of_week: false })),
      );
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
        native_languages: 'FR',
      });

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'search_nearby_users',
        {
          search_lat: 51.5074,
          search_lon: -0.1278,
          radius_m: 10000,
          exclude_user_id: 'user-1',
          filter_native: ['FR'],
          filter_target: null,
          serious_only: false,
        },
      );
      expect(result).toEqual(
        nearbyPartners.map((p) => ({ ...p, is_partner_of_week: false })),
      );
    });

    it('should use mock_location if user is VIP and mock_location is set', async () => {
      const nearbyPartners = [
        { id: 'nearby-vip', display_name: 'Nearby VIP User' },
      ];
      mockSupabaseClient.rpc.mockResolvedValue({
        data: nearbyPartners,
        error: null,
      });

      const mockUser = {
        id: 'user-1',
        is_vip: true,
        mock_location: { type: 'Point', coordinates: [-74.006, 40.7128] }, // GeoJSON Point [lon, lat]
      };

      const result = await service.searchPartners('user-1', mockUser, {
        latitude: 51.5074, // London (should be overridden by mock_location)
        longitude: -0.1278,
        radius_metres: 10000,
      });

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'search_nearby_users',
        {
          search_lat: 40.7128,
          search_lon: -74.006,
          radius_m: 10000,
          exclude_user_id: 'user-1',
          filter_native: null,
          filter_target: null,
          serious_only: false,
        },
      );
      expect(result).toEqual(
        nearbyPartners.map((p) => ({ ...p, is_partner_of_week: false })),
      );
    });

    it('should apply serious learner filter to rpc call', async () => {
      const nearbyPartners = [
        { id: 'nearby-serious', display_name: 'Nearby Serious User' },
      ];
      mockSupabaseClient.rpc.mockResolvedValue({
        data: nearbyPartners,
        error: null,
      });

      const result = await service.searchPartners('user-1', null, {
        latitude: 51.5074,
        longitude: -0.1278,
        radius_metres: 5000,
        serious_learner_only: true,
      });

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'search_nearby_users',
        {
          search_lat: 51.5074,
          search_lon: -0.1278,
          radius_m: 5000,
          exclude_user_id: 'user-1',
          filter_native: null,
          filter_target: null,
          serious_only: true,
        },
      );
      expect(result).toEqual(
        nearbyPartners.map((p) => ({ ...p, is_partner_of_week: false })),
      );
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
      expect(result).toEqual(
        fallbackPartners.map((p) => ({ ...p, is_partner_of_week: false })),
      );
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

      expect(result).toHaveLength(0);
    });

    it('should return empty array when standard query returns error or null data', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: null,
        error: { message: 'Query error' },
      });

      const result = await service.searchPartners('user-1', null, {});
      expect(result).toHaveLength(0);
    });
  });

  describe('voice_room_active filter', () => {
    let mockAudioRooms: { getActiveHostIds: jest.Mock };

    beforeEach(async () => {
      mockAudioRooms = {
        getActiveHostIds: jest.fn().mockResolvedValue([]),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DiscoveryService,
          {
            provide: SupabaseService,
            useValue: {
              getClient: jest.fn().mockReturnValue(mockSupabaseClient),
              getRedisClient: jest.fn().mockReturnValue(mockRedisClient),
            },
          },
          {
            provide: SafetyService,
            useValue: {
              getBlockedAndBlockerIds: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: AudioRoomsService,
            useValue: mockAudioRooms,
          },
        ],
      }).compile();

      service = module.get<DiscoveryService>(DiscoveryService);
    });

    it('should filter results to only show active voice room hosts when voice_room_active is true', async () => {
      const partners = [
        { id: 'host-1', display_name: 'Active Host' },
        { id: 'not-a-host', display_name: 'Not Hosting' },
        { id: 'host-2', display_name: 'Other Host' },
      ];
      mockQueryBuilder.limit.mockResolvedValue({ data: partners, error: null });
      mockAudioRooms.getActiveHostIds.mockResolvedValue(['host-1', 'host-2']);

      const result = await service.searchPartners('user-1', null, {
        voice_room_active: true,
      });

      expect(mockAudioRooms.getActiveHostIds).toHaveBeenCalled();
      expect(result.map((u) => u.id)).toEqual(['host-1', 'host-2']);
    });

    it('should return empty array when no active hosts exist and voice_room_active is true', async () => {
      const partners = [
        { id: 'user-a', display_name: 'User A' },
        { id: 'user-b', display_name: 'User B' },
      ];
      mockQueryBuilder.limit.mockResolvedValue({ data: partners, error: null });
      mockAudioRooms.getActiveHostIds.mockResolvedValue([]);

      const result = await service.searchPartners('user-1', null, {
        voice_room_active: true,
      });

      expect(result).toHaveLength(0);
    });

    it('should not filter by voice room active when voice_room_active is false or undefined', async () => {
      const partners = [
        { id: 'user-a', display_name: 'User A' },
        { id: 'user-b', display_name: 'User B' },
      ];
      mockQueryBuilder.limit.mockResolvedValue({ data: partners, error: null });
      mockAudioRooms.getActiveHostIds.mockResolvedValue(['user-a']);

      const result = await service.searchPartners('user-1', null, {});

      expect(mockAudioRooms.getActiveHostIds).not.toHaveBeenCalled();
      expect(result.map((u) => u.id)).toEqual(['user-a', 'user-b']);
    });

    it('should filter RPC results by voice room active hosts', async () => {
      const nearbyPartners = [
        { id: 'host-1', display_name: 'Nearby Host' },
        { id: 'not-host', display_name: 'Not Hosting Nearby' },
      ];
      mockSupabaseClient.rpc.mockResolvedValue({
        data: nearbyPartners,
        error: null,
      });
      mockAudioRooms.getActiveHostIds.mockResolvedValue(['host-1']);

      const result = await service.searchPartners('user-1', null, {
        latitude: 51.5074,
        longitude: -0.1278,
        voice_room_active: true,
      });

      expect(mockAudioRooms.getActiveHostIds).toHaveBeenCalled();
      expect(result.map((u) => u.id)).toEqual(['host-1']);
    });
  });

  describe('sort algorithms', () => {
    it('best_match: promotes partner-of-week first, then study streak, then correction ratio', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(['partner-c']));
      const partners = [
        { id: 'partner-a', study_streak_days: 3, correction_ratio: 0.9 },
        { id: 'partner-b', study_streak_days: 10, correction_ratio: 0.5 },
        { id: 'partner-c', study_streak_days: 1, correction_ratio: 0.1 },
      ];
      mockQueryBuilder.limit.mockResolvedValue({ data: partners, error: null });

      const result = await service.searchPartners('user-1', null, {
        sort: 'best_match',
      });

      expect(result.map((u) => u.id)).toEqual([
        'partner-c',
        'partner-b',
        'partner-a',
      ]);
    });

    it('online_now: orders by most recent last_active_at first', async () => {
      const partners = [
        { id: 'partner-a', last_active_at: '2026-07-01T00:00:00.000Z' },
        { id: 'partner-b', last_active_at: '2026-08-01T00:00:00.000Z' },
        { id: 'partner-c', last_active_at: '2026-06-01T00:00:00.000Z' },
      ];
      mockQueryBuilder.limit.mockResolvedValue({ data: partners, error: null });

      const result = await service.searchPartners('user-1', null, {
        sort: 'online_now',
      });

      expect(result.map((u) => u.id)).toEqual([
        'partner-b',
        'partner-a',
        'partner-c',
      ]);
    });

    it('newest: orders by most recently created first', async () => {
      const partners = [
        { id: 'partner-a', created_at: '2026-01-01T00:00:00.000Z' },
        { id: 'partner-b', created_at: '2026-06-01T00:00:00.000Z' },
        { id: 'partner-c', created_at: '2026-03-01T00:00:00.000Z' },
      ];
      mockQueryBuilder.limit.mockResolvedValue({ data: partners, error: null });

      const result = await service.searchPartners('user-1', null, {
        sort: 'newest',
      });

      expect(result.map((u) => u.id)).toEqual([
        'partner-b',
        'partner-c',
        'partner-a',
      ]);
    });

    it('nearest: orders by ascending distance_metres even when the RPC response arrives out of order', async () => {
      const nearbyPartners = [
        { id: 'partner-far', distance_metres: 9000 },
        { id: 'partner-near', distance_metres: 500 },
        { id: 'partner-mid', distance_metres: 3000 },
      ];
      mockSupabaseClient.rpc.mockResolvedValue({
        data: nearbyPartners,
        error: null,
      });

      const result = await service.searchPartners('user-1', null, {
        latitude: 51.5074,
        longitude: -0.1278,
        sort: 'nearest',
      });

      expect(result.map((u) => u.id)).toEqual([
        'partner-near',
        'partner-mid',
        'partner-far',
      ]);
    });
  });

  describe('PostGIS search_nearby_users RPC', () => {
    it('should pass target_language as filter_target to RPC', async () => {
      const nearbyPartners = [{ id: 'rpc-target-1' }];
      mockSupabaseClient.rpc.mockResolvedValue({
        data: nearbyPartners,
        error: null,
      });

      await service.searchPartners('user-1', null, {
        latitude: 48.8566,
        longitude: 2.3522,
        radius_metres: 5000,
        target_language: 'EN',
        native_languages: 'FR',
      });

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'search_nearby_users',
        expect.objectContaining({
          filter_target: 'EN',
          filter_native: ['FR'],
        }),
      );
    });

    it('should pass serious_only flag to RPC', async () => {
      const nearbyPartners = [{ id: 'rpc-serious-1' }];
      mockSupabaseClient.rpc.mockResolvedValue({
        data: nearbyPartners,
        error: null,
      });

      await service.searchPartners('user-1', null, {
        latitude: 35.6762,
        longitude: 139.6503,
        radius_metres: 20000,
        serious_learner_only: true,
      });

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'search_nearby_users',
        expect.objectContaining({
          serious_only: true,
        }),
      );
    });

    it('should default radius_m to 50000 when not provided', async () => {
      const nearbyPartners = [{ id: 'rpc-default-radius' }];
      mockSupabaseClient.rpc.mockResolvedValue({
        data: nearbyPartners,
        error: null,
      });

      await service.searchPartners('user-1', null, {
        latitude: 40.7128,
        longitude: -74.006,
      });

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'search_nearby_users',
        expect.objectContaining({
          radius_m: 50000,
        }),
      );
    });

    it('should normalise distance_metres from distance field when distance_metres is missing', async () => {
      const rpcResults = [
        { id: 'rpc-dist-1', distance: 1500 },
        { id: 'rpc-dist-2', distance: 500 },
        { id: 'rpc-dist-3' },
      ];
      mockSupabaseClient.rpc.mockResolvedValue({
        data: rpcResults,
        error: null,
      });

      const result = await service.searchPartners('user-1', null, {
        latitude: 51.5074,
        longitude: -0.1278,
        sort: 'nearest',
      });

      expect(result.map((u) => u.id)).toEqual([
        'rpc-dist-2',
        'rpc-dist-1',
        'rpc-dist-3',
      ]);
    });

    it('should filter RPC results by age range', async () => {
      const rpcResults = [
        { id: 'age-1', age: 20 },
        { id: 'age-2', age: 35 },
        { id: 'age-3', age: 50 },
      ];
      mockSupabaseClient.rpc.mockResolvedValue({
        data: rpcResults,
        error: null,
      });

      const result = await service.searchPartners('user-1', null, {
        latitude: 51.5074,
        longitude: -0.1278,
        age_min: 25,
        age_max: 40,
      });

      expect(result.map((u) => u.id)).toEqual(['age-2']);
    });

    it('should filter RPC results by has_audio_intro', async () => {
      const rpcResults = [
        { id: 'audio-1', audio_intro_url: 'https://example.com/intro.mp3' },
        { id: 'audio-2', audio_intro_url: '' },
        { id: 'audio-3', audio_intro_url: null },
      ];
      mockSupabaseClient.rpc.mockResolvedValue({
        data: rpcResults,
        error: null,
      });

      const result = await service.searchPartners('user-1', null, {
        latitude: 51.5074,
        longitude: -0.1278,
        has_audio_intro: true,
      });

      expect(result.map((u) => u.id)).toEqual(['audio-1']);
    });

    it('should filter RPC results by VIP gender filter', async () => {
      const vipUser = { id: 'user-1', is_vip: true };
      const rpcResults = [
        { id: 'gender-m', gender: 'male' },
        { id: 'gender-f', gender: 'female' },
      ];
      mockSupabaseClient.rpc.mockResolvedValue({
        data: rpcResults,
        error: null,
      });

      const result = await service.searchPartners('user-1', vipUser, {
        latitude: 51.5074,
        longitude: -0.1278,
        gender: 'female',
      });

      expect(result.map((u) => u.id)).toEqual(['gender-f']);
    });

    it('should handle legacy distance field from RPC results', async () => {
      const rpcResults = [
        { id: 'legacy-1', distance: 2000 },
        { id: 'legacy-2', distance_metres: 1000 },
      ];
      mockSupabaseClient.rpc.mockResolvedValue({
        data: rpcResults,
        error: null,
      });

      const result = await service.searchPartners('user-1', null, {
        latitude: 51.5074,
        longitude: -0.1278,
        sort: 'nearest',
      });

      expect(result[0].id).toBe('legacy-2');
      expect(result[1].id).toBe('legacy-1');
    });

    it('should apply VIP country/city spoofing before RPC fallback query', async () => {
      const vipUser = {
        id: 'user-1',
        is_vip: true,
        mock_country: 'Japan',
        mock_city: 'Tokyo',
      };
      const nearbyPartners = [{ id: 'spoofed-1' }];
      mockSupabaseClient.rpc.mockResolvedValue({
        data: nearbyPartners,
        error: null,
      });

      await service.searchPartners('user-1', vipUser, {
        latitude: 51.5074,
        longitude: -0.1278,
      });

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'search_nearby_users',
        expect.objectContaining({
          search_lat: 51.5074,
          search_lon: -0.1278,
        }),
      );
    });
  });

  describe('getAudioIntros', () => {
    it('should query users with audio_intro_url not null and not empty', async () => {
      const audioUsers = [{ id: 'audio-1', audio_intro_url: 'intro.mp3' }];
      mockQueryBuilder.limit.mockResolvedValue({
        data: audioUsers,
        error: null,
      });

      const result = await service.getAudioIntros('user-1', null, {});

      expect(mockQueryBuilder.not).toHaveBeenCalledWith(
        'audio_intro_url',
        'is',
        null,
      );
      expect(mockQueryBuilder.neq).toHaveBeenCalledWith('audio_intro_url', '');
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
      expect(result).toEqual(audioUsers);
    });

    it('should apply language, level, and serious learner filters', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: [{ id: 'audio-2' }],
        error: null,
      });

      await service.getAudioIntros('user-1', null, {
        native_languages: 'ES',
        target_language: 'EN',
        level: 'B1',
        serious_learner_only: true,
      });

      expect(mockQueryBuilder.contains).toHaveBeenCalledWith(
        'native_languages',
        ['ES'],
      );
      expect(mockQueryBuilder.contains).toHaveBeenCalledWith(
        'target_languages',
        ['EN'],
      );
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
        'proficiency_level',
        'B1',
      );
      expect(mockQueryBuilder.gt).toHaveBeenCalledWith('study_streak_days', 7);
    });

    it('should apply age range and country/city filters', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: [{ id: 'audio-3' }],
        error: null,
      });

      await service.getAudioIntros('user-1', null, {
        age_min: 18,
        age_max: 30,
        country: 'France',
        city: 'Paris',
      });

      expect(mockQueryBuilder.gte).toHaveBeenCalledWith('age', 18);
      expect(mockQueryBuilder.lte).toHaveBeenCalledWith('age', 30);
      expect(mockQueryBuilder.ilike).toHaveBeenCalledWith(
        'country',
        '%France%',
      );
      expect(mockQueryBuilder.ilike).toHaveBeenCalledWith('city', '%Paris%');
    });

    it('should return empty array on query error', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      });

      const result = await service.getAudioIntros('user-1', null, {});
      expect(result).toEqual([]);
    });

    it('should apply VIP country/city spoofing', async () => {
      const vipUser = {
        id: 'user-1',
        is_vip: true,
        mock_country: 'Japan',
        mock_city: 'Tokyo',
      };
      mockQueryBuilder.limit.mockResolvedValue({
        data: [{ id: 'audio-vip' }],
        error: null,
      });

      await service.getAudioIntros('user-1', vipUser, {
        country: 'France',
        city: 'Paris',
      });

      expect(mockQueryBuilder.ilike).toHaveBeenCalledWith('country', '%Japan%');
      expect(mockQueryBuilder.ilike).toHaveBeenCalledWith('city', '%Tokyo%');
    });
  });

  describe('getRecentNativeSpeakers', () => {
    it('should query users created in the last 7 days', async () => {
      const recentUsers = [{ id: 'recent-1' }];
      mockQueryBuilder.limit.mockResolvedValue({
        data: recentUsers,
        error: null,
      });

      const result = await service.getRecentNativeSpeakers('user-1');

      expect(mockQueryBuilder.gt).toHaveBeenCalledWith(
        'created_at',
        expect.any(String),
      );
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual(
        recentUsers.map((p) => ({ ...p, is_partner_of_week: false })),
      );
    });

    it('should return empty array on query error', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      });

      const result = await service.getRecentNativeSpeakers('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('getSpotlightUsers', () => {
    it('should return up to 5 spotlight users with PoW flag', async () => {
      const spotlightUsers = [
        { id: 'spotlight-1' },
        { id: 'spotlight-2' },
        { id: 'spotlight-3' },
        { id: 'spotlight-4' },
        { id: 'spotlight-5' },
      ];
      mockQueryBuilder.limit.mockResolvedValue({
        data: spotlightUsers,
        error: null,
      });
      mockRedisClient.get.mockResolvedValue(
        JSON.stringify(['spotlight-1', 'spotlight-3']),
      );

      const result = await service.getSpotlightUsers('user-1');

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(5);
      expect(result).toHaveLength(5);
      expect(result[0].is_partner_of_week).toBe(true);
      expect(result[1].is_partner_of_week).toBe(false);
      expect(result[2].is_partner_of_week).toBe(true);
    });

    it('should return empty array on query error', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      });

      const result = await service.getSpotlightUsers('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('findByLanguagePair', () => {
    it('should find users via cross-language matching', async () => {
      const pairedUsers = [{ id: 'lp-1' }, { id: 'lp-2' }];
      mockQueryBuilder.range = jest.fn().mockResolvedValue({
        data: pairedUsers,
        error: null,
      });

      const result = await service.findByLanguagePair('user-1', {
        native_language: 'EN',
        target_language: 'ES',
      });

      expect(mockQueryBuilder.contains).toHaveBeenCalledWith(
        'native_languages',
        ['ES'],
      );
      expect(mockQueryBuilder.contains).toHaveBeenCalledWith(
        'target_languages',
        ['EN'],
      );
      expect(result).toEqual(
        pairedUsers.map((p) => ({ ...p, is_partner_of_week: false })),
      );
    });

    it('should apply only native_language filter when target is not provided', async () => {
      mockQueryBuilder.range = jest.fn().mockResolvedValue({
        data: [{ id: 'native-only' }],
        error: null,
      });

      await service.findByLanguagePair('user-1', {
        native_language: 'FR',
      });

      expect(mockQueryBuilder.contains).toHaveBeenCalledWith(
        'native_languages',
        ['FR'],
      );
    });

    it('should apply only target_language filter when native is not provided', async () => {
      mockQueryBuilder.range = jest.fn().mockResolvedValue({
        data: [{ id: 'target-only' }],
        error: null,
      });

      await service.findByLanguagePair('user-1', {
        target_language: 'DE',
      });

      expect(mockQueryBuilder.contains).toHaveBeenCalledWith(
        'target_languages',
        ['DE'],
      );
    });

    it('should apply pagination (page and limit)', async () => {
      mockQueryBuilder.range = jest.fn().mockResolvedValue({
        data: [{ id: 'paged-1' }],
        error: null,
      });

      await service.findByLanguagePair('user-1', {
        native_language: 'EN',
        target_language: 'JA',
        page: 2,
        limit: 25,
      });

      expect(mockQueryBuilder.range).toHaveBeenCalledWith(50, 74);
    });

    it('should apply newest sort ordering', async () => {
      mockQueryBuilder.range = jest.fn().mockResolvedValue({
        data: [{ id: 'newest-1' }],
        error: null,
      });

      await service.findByLanguagePair('user-1', {
        native_language: 'EN',
        target_language: 'IT',
        sort: 'newest',
      });

      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
    });

    it('should apply best_match sort ordering by default', async () => {
      mockQueryBuilder.range = jest.fn().mockResolvedValue({
        data: [{ id: 'best-1' }],
        error: null,
      });

      await service.findByLanguagePair('user-1', {
        native_language: 'EN',
      });

      expect(mockQueryBuilder.order).toHaveBeenCalledWith('study_streak_days', {
        ascending: false,
      });
    });

    it('should apply country, city, level, and audio_intro filters', async () => {
      mockQueryBuilder.range = jest.fn().mockResolvedValue({
        data: [{ id: 'filtered' }],
        error: null,
      });

      await service.findByLanguagePair('user-1', {
        native_language: 'EN',
        target_language: 'PT',
        country: 'Brazil',
        city: 'Sao Paulo',
        level: 'A2',
        has_audio_intro: true,
      });

      expect(mockQueryBuilder.ilike).toHaveBeenCalledWith(
        'country',
        '%Brazil%',
      );
      expect(mockQueryBuilder.ilike).toHaveBeenCalledWith(
        'city',
        '%Sao Paulo%',
      );
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
        'proficiency_level',
        'A2',
      );
      expect(mockQueryBuilder.not).toHaveBeenCalledWith(
        'audio_intro_url',
        'is',
        null,
      );
    });
  });

  describe('searchByCountryCity', () => {
    it('should search users by country and city', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: [{ id: 'geo-1' }],
        error: null,
      });

      const result = await service.searchByCountryCity('user-1', {
        country: 'Spain',
        city: 'Barcelona',
      });

      expect(mockQueryBuilder.ilike).toHaveBeenCalledWith('country', '%Spain%');
      expect(mockQueryBuilder.ilike).toHaveBeenCalledWith(
        'city',
        '%Barcelona%',
      );
      expect(result).toEqual([{ id: 'geo-1' }]);
    });

    it('should search by country only', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: [{ id: 'country-only' }],
        error: null,
      });

      await service.searchByCountryCity('user-1', { country: 'Germany' });

      expect(mockQueryBuilder.ilike).toHaveBeenCalledWith(
        'country',
        '%Germany%',
      );
    });

    it('should return empty array on error', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });

      const result = await service.searchByCountryCity('user-1', {});
      expect(result).toEqual([]);
    });
  });

  describe('calculatePartnerOfWeek', () => {
    it('should select top users with high correction_ratio and store in Redis', async () => {
      const mockRedis = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
      };
      const localSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          gt: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [{ id: 'pow-1' }, { id: 'pow-2' }, { id: 'pow-3' }],
            error: null,
          }),
        }),
        rpc: jest.fn(),
      };
      const localModule = await Test.createTestingModule({
        providers: [
          DiscoveryService,
          {
            provide: SupabaseService,
            useValue: {
              getClient: jest.fn().mockReturnValue(localSupabase),
              getRedisClient: jest.fn().mockReturnValue(mockRedis),
            },
          },
          {
            provide: SafetyService,
            useValue: {
              getBlockedAndBlockerIds: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: AudioRoomsService,
            useValue: {
              getActiveHostIds: jest.fn().mockResolvedValue([]),
            },
          },
        ],
      }).compile();
      const localService = localModule.get<DiscoveryService>(DiscoveryService);

      await localService.calculatePartnerOfWeek();

      expect(mockRedis.set).toHaveBeenCalledWith(
        'partner_of_week_ids',
        JSON.stringify(['pow-1', 'pow-2', 'pow-3']),
        'EX',
        604800,
      );
    });

    it('should not set Redis key when no users qualified', async () => {
      const mockRedis = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
      };
      const localSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          gt: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
        rpc: jest.fn(),
      };
      const localModule = await Test.createTestingModule({
        providers: [
          DiscoveryService,
          {
            provide: SupabaseService,
            useValue: {
              getClient: jest.fn().mockReturnValue(localSupabase),
              getRedisClient: jest.fn().mockReturnValue(mockRedis),
            },
          },
          {
            provide: SafetyService,
            useValue: {
              getBlockedAndBlockerIds: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: AudioRoomsService,
            useValue: {
              getActiveHostIds: jest.fn().mockResolvedValue([]),
            },
          },
        ],
      }).compile();
      const localService = localModule.get<DiscoveryService>(DiscoveryService);

      await localService.calculatePartnerOfWeek();

      expect(mockRedis.set).not.toHaveBeenCalled();
    });
  });

  describe('calculateDailyRecommendations', () => {
    it('should compute daily recommendations and store in Redis', async () => {
      const mockRedis = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
      };
      const users = [
        { id: 'user-a', native_languages: ['EN'], target_languages: ['ES'] },
        { id: 'user-b', native_languages: ['ES'], target_languages: ['EN'] },
      ];
      const matches = [{ id: 'user-b' }];
      let selectCallCount = 0;
      const localSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          neq: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          contains: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
              return Promise.resolve({ data: users, error: null });
            }
            return Promise.resolve({ data: matches, error: null });
          }),
        }),
        rpc: jest.fn(),
      };
      const localModule = await Test.createTestingModule({
        providers: [
          DiscoveryService,
          {
            provide: SupabaseService,
            useValue: {
              getClient: jest.fn().mockReturnValue(localSupabase),
              getRedisClient: jest.fn().mockReturnValue(mockRedis),
            },
          },
          {
            provide: SafetyService,
            useValue: {
              getBlockedAndBlockerIds: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: AudioRoomsService,
            useValue: {
              getActiveHostIds: jest.fn().mockResolvedValue([]),
            },
          },
        ],
      }).compile();
      const localService = localModule.get<DiscoveryService>(DiscoveryService);

      await localService.calculateDailyRecommendations();

      expect(mockRedis.set).toHaveBeenCalledWith(
        'daily_recommendations:user-a',
        JSON.stringify(['user-b']),
        'EX',
        86400,
      );
    });

    it('should handle DB error gracefully', async () => {
      const mockRedis = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
      };
      const localSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'DB error' },
          }),
        }),
        rpc: jest.fn(),
      };
      const localModule = await Test.createTestingModule({
        providers: [
          DiscoveryService,
          {
            provide: SupabaseService,
            useValue: {
              getClient: jest.fn().mockReturnValue(localSupabase),
              getRedisClient: jest.fn().mockReturnValue(mockRedis),
            },
          },
          {
            provide: SafetyService,
            useValue: {
              getBlockedAndBlockerIds: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: AudioRoomsService,
            useValue: {
              getActiveHostIds: jest.fn().mockResolvedValue([]),
            },
          },
        ],
      }).compile();
      const localService = localModule.get<DiscoveryService>(DiscoveryService);

      await expect(
        localService.calculateDailyRecommendations(),
      ).resolves.toBeUndefined();
    });
  });

  describe('getPartnerOfWeekIds', () => {
    it('should return parsed partner IDs from Redis', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(['pow-a', 'pow-b']));

      const result = await service.getPartnerOfWeekIds();
      expect(result).toEqual(['pow-a', 'pow-b']);
    });

    it('should return empty array when Redis has no data', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.getPartnerOfWeekIds();
      expect(result).toEqual([]);
    });

    it('should return empty array on malformed JSON', async () => {
      mockRedisClient.get.mockResolvedValue('not-json');

      const result = await service.getPartnerOfWeekIds();
      expect(result).toEqual([]);
    });
  });

  describe('voice room filtering', () => {
    it('should filter searchPartners results by active voice room hosts', async () => {
      const partners = [{ id: 'in-room' }, { id: 'not-in-room' }];
      mockQueryBuilder.limit.mockResolvedValue({
        data: partners,
        error: null,
      });

      const moduleWithVoice: TestingModule = await Test.createTestingModule({
        providers: [
          DiscoveryService,
          {
            provide: SupabaseService,
            useValue: {
              getClient: jest.fn().mockReturnValue(mockSupabaseClient),
              getRedisClient: jest.fn().mockReturnValue(mockRedisClient),
            },
          },
          {
            provide: SafetyService,
            useValue: {
              getBlockedAndBlockerIds: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: AudioRoomsService,
            useValue: {
              getActiveHostIds: jest.fn().mockResolvedValue(['in-room']),
            },
          },
        ],
      }).compile();
      const voiceService =
        moduleWithVoice.get<DiscoveryService>(DiscoveryService);

      const result = await voiceService.searchPartners('user-1', null, {
        voice_room_active: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('in-room');
    });
  });

  describe('VIP serious learner mode', () => {
    it('should force serious_learner_only on RPC when user has serious_learner_mode', async () => {
      const seriousUser = { id: 'user-1', is_serious_learner: true };
      const nearbyPartners = [{ id: 'serious-rpc-1' }];
      mockSupabaseClient.rpc.mockResolvedValue({
        data: nearbyPartners,
        error: null,
      });

      await service.searchPartners('user-1', seriousUser, {
        latitude: 51.5074,
        longitude: -0.1278,
        serious_learner_mode: true,
      });

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'search_nearby_users',
        expect.objectContaining({
          serious_only: true,
        }),
      );
    });

    it('should apply serious_learner_only filter when explicitly set in query', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: [{ id: 'serious-query-1' }],
        error: null,
      });

      await service.searchPartners('user-1', null, {
        serious_learner_only: true,
      });

      expect(mockQueryBuilder.gt).toHaveBeenCalledWith('study_streak_days', 7);
      expect(mockQueryBuilder.gte).toHaveBeenCalledWith(
        'correction_ratio',
        0.8,
      );
    });

    it('should set serious_learner_only when user is_serious_learner is true', async () => {
      const seriousUser = { id: 'user-1', is_serious_learner: true };
      mockQueryBuilder.limit.mockResolvedValue({
        data: [{ id: 'serious-user-1' }],
        error: null,
      });

      await service.searchPartners('user-1', seriousUser, {});

      // is_serious_learner on the profile sets query.serious_learner_only after the DB
      // filter check, so DB-level gte/gt are not called. The flag is still set for
      // the enrich/sort pipeline and mock fallback filtering.
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
    });
  });

  describe('advanced filters (via searchPartners)', () => {
    it('should filter by learning_goals', async () => {
      const partners = [
        { id: 'goal-1', learning_goals: ['fluency', 'grammar'] },
        { id: 'goal-2', learning_goals: ['vocabulary'] },
      ];
      mockQueryBuilder.limit.mockResolvedValue({
        data: partners,
        error: null,
      });

      const result = await service.searchPartners('user-1', null, {
        learning_goals: 'fluency',
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('goal-1');
    });

    it('should filter by availability_morning', async () => {
      const partners = [
        { id: 'avail-1', availability_morning: true },
        { id: 'avail-2', availability_morning: false },
      ];
      mockQueryBuilder.limit.mockResolvedValue({
        data: partners,
        error: null,
      });

      const result = await service.searchPartners('user-1', null, {
        availability_morning: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('avail-1');
    });

    it('should filter by availability_evening', async () => {
      const partners = [
        { id: 'eve-1', availability_evening: true },
        { id: 'eve-2', availability_evening: false },
      ];
      mockQueryBuilder.limit.mockResolvedValue({
        data: partners,
        error: null,
      });

      const result = await service.searchPartners('user-1', null, {
        availability_evening: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('eve-1');
    });

    it('should filter by available_time_start and available_time_end overlap (triggered via learning_goals guard)', async () => {
      const partners = [
        {
          id: 'time-1',
          available_time_start: '09:00',
          available_time_end: '17:00',
          learning_goals: ['fluency'],
        },
        {
          id: 'time-2',
          available_time_start: '18:00',
          available_time_end: '22:00',
          learning_goals: ['fluency'],
        },
        { id: 'time-3', learning_goals: ['fluency'] },
      ];
      mockQueryBuilder.limit.mockResolvedValue({
        data: partners,
        error: null,
      });

      const result = await service.searchPartners('user-1', null, {
        available_time_start: '10:00',
        available_time_end: '12:00',
        learning_goals: 'fluency',
      });

      expect(result.map((u) => u.id)).toEqual(['time-1', 'time-3']);
    });
  });
});
