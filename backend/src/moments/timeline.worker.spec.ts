import { Test, TestingModule } from '@nestjs/testing';
import { TimelineWorker } from './timeline.worker';
import { SupabaseService } from '../supabase/supabase.service';

describe('TimelineWorker', () => {
  let worker: TimelineWorker;
  let mockSupabaseClient: any;
  let mockRedisClient: any;
  let mockQueryBuilder: any;
  let mockTransaction: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      limit: vi.fn(),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    mockTransaction = {
      lrem: vi.fn().mockReturnThis(),
      rpush: vi.fn().mockReturnThis(),
      lmove: vi.fn().mockReturnThis(),
      ltrim: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    };

    mockRedisClient = {
      multi: vi.fn().mockReturnValue(mockTransaction),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimelineWorker,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
            getRedisClient: vi.fn().mockReturnValue(mockRedisClient),
          },
        },
      ],
    }).compile();

    worker = module.get<TimelineWorker>(TimelineWorker);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  describe('fanOutMoment', () => {
    it('fans out with retry-safe RPUSH transactions and bounded queues', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: [
          { follower_id: 'follower-1' },
          { follower_id: 'follower-1' },
          { follower_id: 'follower-2' },
        ],
        error: null,
      });
      const logSpy = vi
        .spyOn((worker as any).logger, 'log')
        .mockImplementation(() => {});

      await worker.fanOutMoment('moment-100', 'author-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_follows');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('follower_id');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
        'following_id',
        'author-1',
      );
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('follower_id', {
        ascending: true,
      });
      expect(mockQueryBuilder.gt).not.toHaveBeenCalled();
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(500);

      expect(mockRedisClient.multi).toHaveBeenCalledTimes(1);
      expect(mockTransaction.lrem).toHaveBeenCalledTimes(3);
      expect(mockTransaction.rpush).toHaveBeenCalledTimes(3);
      expect(mockTransaction.rpush).toHaveBeenCalledWith(
        'timeline_queue:follower-1',
        'moment-100',
      );
      expect(mockTransaction.rpush).toHaveBeenCalledWith(
        'timeline_queue:follower-2',
        'moment-100',
      );
      expect(mockTransaction.rpush).toHaveBeenCalledWith(
        'timeline_queue:author-1',
        'moment-100',
      );
      expect(mockTransaction.lmove).toHaveBeenCalledWith(
        'timeline_queue:follower-1',
        'timeline_queue:follower-1',
        'RIGHT',
        'LEFT',
      );
      expect(mockTransaction.ltrim).toHaveBeenCalledTimes(3);
      expect(mockTransaction.ltrim).toHaveBeenCalledWith(
        'timeline_queue:follower-1',
        0,
        499,
      );
      expect(mockTransaction.exec).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        'Timeline fan-out completed for 3 recipients.',
      );
      logSpy.mockRestore();
    });

    it('queues the author when there are no followers', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: [], error: null });

      await worker.fanOutMoment('moment-100', 'author-1');

      expect(mockTransaction.rpush).toHaveBeenCalledTimes(1);
      expect(mockTransaction.rpush).toHaveBeenCalledWith(
        'timeline_queue:author-1',
        'moment-100',
      );
    });

    it('treats null follower data as a successful empty result', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: null, error: null });

      await worker.fanOutMoment('moment-100', 'author-1');

      expect(mockTransaction.rpush).toHaveBeenCalledWith(
        'timeline_queue:author-1',
        'moment-100',
      );
    });

    it('uses a follower-id cursor for large follower sets', async () => {
      const firstPage = Array.from({ length: 500 }, (_, index) => ({
        follower_id: `follower-${String(index).padStart(3, '0')}`,
      }));
      mockQueryBuilder.limit
        .mockResolvedValueOnce({ data: firstPage, error: null })
        .mockResolvedValueOnce({
          data: [{ follower_id: 'follower-500' }],
          error: null,
        });

      await worker.fanOutMoment('moment-100', 'author-1');

      expect(mockQueryBuilder.limit).toHaveBeenCalledTimes(2);
      expect(mockQueryBuilder.limit).toHaveBeenNthCalledWith(1, 500);
      expect(mockQueryBuilder.limit).toHaveBeenNthCalledWith(2, 500);
      expect(mockQueryBuilder.gt).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.gt).toHaveBeenCalledWith(
        'follower_id',
        'follower-499',
      );
      expect(mockRedisClient.multi).toHaveBeenCalledTimes(2);
      expect(mockTransaction.rpush).toHaveBeenCalledTimes(502);
    });

    it('fails safely instead of looping when a full page does not advance its cursor', async () => {
      const repeatedPage = Array.from({ length: 500 }, () => ({
        follower_id: 'follower-499',
      }));
      const firstPage = Array.from({ length: 500 }, (_, index) => ({
        follower_id: `follower-${String(index).padStart(3, '0')}`,
      }));
      mockQueryBuilder.limit
        .mockResolvedValueOnce({ data: firstPage, error: null })
        .mockResolvedValueOnce({ data: repeatedPage, error: null });
      const errorSpy = vi
        .spyOn((worker as any).logger, 'error')
        .mockImplementation(() => {});

      await worker.fanOutMoment('moment-secret', 'author-secret');

      expect(mockQueryBuilder.limit).toHaveBeenCalledTimes(2);
      expect(mockQueryBuilder.gt).toHaveBeenCalledWith(
        'follower_id',
        'follower-499',
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'Timeline fan-out failed (TimelinePaginationError).',
      );
      expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(
        'moment-secret',
      );
      expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(
        'author-secret',
      );
      errorSpy.mockRestore();
    });

    it('retries a failed follower lookup once before succeeding', async () => {
      mockQueryBuilder.limit
        .mockResolvedValueOnce({ data: null, error: { message: 'temporary' } })
        .mockResolvedValueOnce({ data: [], error: null });

      await worker.fanOutMoment('moment-100', 'author-1');

      expect(mockQueryBuilder.limit).toHaveBeenCalledTimes(2);
      expect(mockTransaction.rpush).toHaveBeenCalledWith(
        'timeline_queue:author-1',
        'moment-100',
      );
    });

    it('retries a failed Redis transaction without creating a second logical entry', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: [], error: null });
      mockTransaction.exec
        .mockResolvedValueOnce([[new Error('temporary'), null]])
        .mockResolvedValueOnce([]);

      await worker.fanOutMoment('moment-100', 'author-1');

      expect(mockRedisClient.multi).toHaveBeenCalledTimes(2);
      expect(mockTransaction.lrem).toHaveBeenCalledTimes(2);
      expect(mockTransaction.rpush).toHaveBeenCalledTimes(2);
      expect(mockTransaction.exec).toHaveBeenCalledTimes(2);
    });

    it('logs only a sanitized failure classification after follower lookup failure', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: null,
        error: { message: 'database host and credentials' },
      });
      const errorSpy = vi
        .spyOn((worker as any).logger, 'error')
        .mockImplementation(() => {});

      await worker.fanOutMoment('moment-secret', 'author-secret');

      expect(mockQueryBuilder.limit).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.multi).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        'Timeline fan-out failed (TimelineFollowerLookupError).',
      );
      expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(
        'moment-secret',
      );
      expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(
        'author-secret',
      );
      expect(errorSpy.mock.calls.flat().join(' ')).not.toContain('credentials');
      errorSpy.mockRestore();
    });

    it('does not expose Redis provider details when both transaction attempts fail', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: [], error: null });
      mockTransaction.exec.mockRejectedValue(
        new Error('redis://user:secret@private-host'),
      );
      const errorSpy = vi
        .spyOn((worker as any).logger, 'error')
        .mockImplementation(() => {});

      await worker.fanOutMoment('moment-secret', 'author-secret');

      expect(mockTransaction.exec).toHaveBeenCalledTimes(2);
      expect(errorSpy).toHaveBeenCalledWith(
        'Timeline fan-out failed (TimelineQueueWriteError).',
      );
      expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(
        'private-host',
      );
      expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(
        'moment-secret',
      );
      errorSpy.mockRestore();
    });
  });
});
