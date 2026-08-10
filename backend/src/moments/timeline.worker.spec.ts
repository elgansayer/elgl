import { Test, TestingModule } from '@nestjs/testing';
import { TimelineWorker } from './timeline.worker';
import { SupabaseService } from '../supabase/supabase.service';

describe('TimelineWorker', () => {
  let worker: TimelineWorker;
  let mockSupabaseClient: any;
  let mockRedisClient: any;
  let mockQueryBuilder: any;
  let mockPipeline: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    mockPipeline = {
      lpush: jest.fn().mockReturnThis(),
      ltrim: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };

    mockRedisClient = {
      pipeline: jest.fn().mockReturnValue(mockPipeline),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimelineWorker,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
            getRedisClient: jest.fn().mockReturnValue(mockRedisClient),
          },
        },
      ],
    }).compile();

    worker = module.get<TimelineWorker>(TimelineWorker);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  describe('fanOutMoment', () => {
    it('should query followers, push moment ID to redis queues, and trim queues', async () => {
      const followers = [
        { follower_id: 'follower-1' },
        { follower_id: 'follower-2' },
      ];
      mockQueryBuilder.eq.mockResolvedValue({
        data: followers,
        error: null,
      });

      const logSpy = jest
        .spyOn((worker as any).logger, 'log')
        .mockImplementation(() => {});

      await worker.fanOutMoment('moment-100', 'author-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_follows');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('follower_id');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
        'following_id',
        'author-1',
      );

      // follower-1, follower-2, author-1 -> 3 total pushes via pipeline
      expect(mockRedisClient.pipeline).toHaveBeenCalled();
      expect(mockPipeline.lpush).toHaveBeenCalledTimes(3);
      expect(mockPipeline.lpush).toHaveBeenCalledWith(
        'timeline_queue:follower-1',
        'moment-100',
      );
      expect(mockPipeline.lpush).toHaveBeenCalledWith(
        'timeline_queue:follower-2',
        'moment-100',
      );
      expect(mockPipeline.lpush).toHaveBeenCalledWith(
        'timeline_queue:author-1',
        'moment-100',
      );
      expect(mockPipeline.ltrim).toHaveBeenCalledTimes(3);
      expect(mockPipeline.ltrim).toHaveBeenCalledWith(
        'timeline_queue:follower-1',
        0,
        499,
      );
      expect(mockPipeline.exec).toHaveBeenCalled();

      expect(logSpy).toHaveBeenCalledWith(
        'Fanned out moment moment-100 to 3 followers via Redis queue.',
      );
      logSpy.mockRestore();
    });

    it('should return early when query returns error or null data', async () => {
      mockQueryBuilder.eq.mockResolvedValue({
        data: null,
        error: { message: 'DB fail' },
      });

      await worker.fanOutMoment('moment-100', 'author-1');

      expect(mockRedisClient.lpush).not.toHaveBeenCalled();
    });

    it('should catch error during execution and log error', async () => {
      mockQueryBuilder.eq.mockRejectedValue(new Error('Redis crash'));
      const errorSpy = jest
        .spyOn((worker as any).logger, 'error')
        .mockImplementation(() => {});

      await worker.fanOutMoment('moment-100', 'author-1');

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to fan-out moment moment-100: Redis crash',
      );
      errorSpy.mockRestore();
    });
  });
});
