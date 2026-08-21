import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { VideoCallsCacheInvalidationService } from './video-calls-cache-invalidation.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('VideoCallsCacheInvalidationService', () => {
  let service: VideoCallsCacheInvalidationService;
  let mockRedis: Record<string, Mock>;
  let mockSupabaseService: { getRedisClient: Mock };

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

    mockRedis = {
      del: vi.fn(),
      scan: vi.fn(),
      keys: vi.fn(),
    };

    mockRedis.del.mockResolvedValue(0);
    mockRedis.scan.mockResolvedValue(['0', []]);
    mockRedis.keys.mockResolvedValue([]);

    mockSupabaseService = {
      getRedisClient: vi.fn().mockReturnValue(mockRedis),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoCallsCacheInvalidationService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<VideoCallsCacheInvalidationService>(
      VideoCallsCacheInvalidationService,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('invalidateRoomCaches', () => {
    it('should delete room-specific keys when roomId is provided', async () => {
      mockRedis.del.mockResolvedValueOnce(3); // room-specific keys
      mockRedis.del.mockResolvedValueOnce(0); // host:dashboard key (may be resolved together)

      await service.invalidateRoomCaches('room-123');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'video:classroom:room:room-123',
        'video:classroom:participants:room-123',
        'video:classroom:recording:room-123',
      );
    });

    it('should scan-and-delete room list patterns', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);
      mockRedis.del.mockResolvedValueOnce(0); // room-specific (none when no roomId)
      mockRedis.del.mockResolvedValueOnce(0); // host:dashboard key

      await service.invalidateRoomCaches();

      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'video:classroom:list*',
        'COUNT',
        500,
      );
    });

    it('should delete host dashboard aggregate key', async () => {
      mockRedis.del.mockResolvedValueOnce(0); // room-specific
      mockRedis.del.mockResolvedValueOnce(1); // host:dashboard

      await service.invalidateRoomCaches();

      expect(mockRedis.del).toHaveBeenCalledWith(
        'host:dashboard:active:video_rooms',
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis connection lost'));

      await expect(
        service.invalidateRoomCaches('room-err'),
      ).resolves.toBeUndefined();
    });
  });

  describe('invalidateParticipantCaches', () => {
    it('should delete participant roster and room detail keys', async () => {
      mockRedis.del.mockResolvedValue(2);

      await service.invalidateParticipantCaches('room-456');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'video:classroom:participants:room-456',
        'video:classroom:room:room-456',
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.invalidateParticipantCaches('room-456'),
      ).resolves.toBeUndefined();
    });
  });

  describe('invalidateRecordingCaches', () => {
    it('should delete recording metadata and room detail keys', async () => {
      mockRedis.del.mockResolvedValue(2);

      await service.invalidateRecordingCaches('room-789');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'video:classroom:recording:room-789',
        'video:classroom:room:room-789',
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.invalidateRecordingCaches('room-789'),
      ).resolves.toBeUndefined();
    });
  });

  describe('invalidateAllVideoClassroomCaches', () => {
    it('should scan-delete suffixed patterns and direct-delete exact keys', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);
      // Pattern sequence: list:* (scan), room:* (scan), participants:* (scan),
      // recording:* (scan), host:dashboard (direct del)
      mockRedis.del
        .mockResolvedValueOnce(0) // scan: list
        .mockResolvedValueOnce(0) // scan: room
        .mockResolvedValueOnce(0) // scan: participants
        .mockResolvedValueOnce(0) // scan: recording
        .mockResolvedValueOnce(0); // direct: host:dashboard

      await service.invalidateAllVideoClassroomCaches();

      // All 4 suffixed patterns should trigger scan calls
      expect(mockRedis.scan).toHaveBeenCalledTimes(4);
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'video:classroom:list*',
        'COUNT',
        500,
      );
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'video:classroom:room*',
        'COUNT',
        500,
      );
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'video:classroom:participants*',
        'COUNT',
        500,
      );
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'video:classroom:recording*',
        'COUNT',
        500,
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        'host:dashboard:active:video_rooms',
      );
    });

    it('should accumulate and log the deleted count across patterns', async () => {
      // Simulate finding keys for each pattern
      mockRedis.scan
        .mockResolvedValueOnce(['0', ['video:classroom:list:en-ja:20:']])
        .mockResolvedValueOnce(['0', ['video:classroom:room:abc']])
        .mockResolvedValueOnce(['0', []])
        .mockResolvedValueOnce(['0', []]);
      mockRedis.del
        .mockResolvedValueOnce(1) // list scan
        .mockResolvedValueOnce(1) // room scan
        .mockResolvedValueOnce(0) // participants scan
        .mockResolvedValueOnce(0) // recording scan
        .mockResolvedValueOnce(1); // host:dashboard

      await service.invalidateAllVideoClassroomCaches();

      expect(Logger.prototype.log).toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.scan.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.invalidateAllVideoClassroomCaches(),
      ).resolves.toBeUndefined();
    });
  });

  describe('event-driven invalidation', () => {
    it('should handle ROOM_MUTATED event', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);
      mockRedis.del.mockResolvedValue(0);

      await service.handleRoomMutated({ roomId: 'event-room' });

      expect(mockRedis.del).toHaveBeenCalledWith(
        'video:classroom:room:event-room',
        'video:classroom:participants:event-room',
        'video:classroom:recording:event-room',
      );
    });

    it('should handle PARTICIPANT_MUTATED event', async () => {
      mockRedis.del.mockResolvedValue(2);

      await service.handleParticipantMutated({ roomId: 'event-room' });

      expect(mockRedis.del).toHaveBeenCalledWith(
        'video:classroom:participants:event-room',
        'video:classroom:room:event-room',
      );
    });

    it('should handle RECORDING_MUTATED event', async () => {
      mockRedis.del.mockResolvedValue(2);

      await service.handleRecordingMutated({ roomId: 'event-room' });

      expect(mockRedis.del).toHaveBeenCalledWith(
        'video:classroom:recording:event-room',
        'video:classroom:room:event-room',
      );
    });
  });

  describe('deleteByScan (via invalidateAllVideoClassroomCaches)', () => {
    it('should iterate until cursor returns 0', async () => {
      // First pattern scan (list:*) returns keys across 2 iterations
      // Remaining 3 pattern scans return empty (no del calls for those)
      mockRedis.scan
        .mockResolvedValueOnce(['5', ['video:classroom:list:en-ja:20:']])
        .mockResolvedValueOnce(['0', ['video:classroom:list:zh-en:20:']])
        .mockResolvedValueOnce(['0', []])
        .mockResolvedValueOnce(['0', []])
        .mockResolvedValueOnce(['0', []]);
      mockRedis.del
        .mockResolvedValueOnce(1) // list batch 1 (scan iteration 1)
        .mockResolvedValueOnce(1) // list batch 2 (scan iteration 2)
        .mockResolvedValueOnce(0); // host:dashboard direct del

      await service.invalidateAllVideoClassroomCaches();

      // 5 scan calls: 2 iter for list + 1 each for room/participants/recording patterns
      expect(mockRedis.scan).toHaveBeenCalledTimes(5);
      // 3 del calls: 2 for list scan batches + 1 host:dashboard
      expect(mockRedis.del).toHaveBeenCalledTimes(3);
    });
  });
});
