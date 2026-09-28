import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Mock } from 'vitest';
import { SupabaseService } from '../supabase/supabase.service';
import {
  MomentsCacheInvalidationService,
  MomentsCacheInvalidationTrigger,
} from './moments-cache-invalidation.service';

describe('MomentsCacheInvalidationService', () => {
  let service: MomentsCacheInvalidationService;
  let redis: Record<string, Mock>;
  let pipeline: Record<string, Mock>;

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    pipeline = {
      lrem: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    };
    redis = {
      del: vi.fn().mockResolvedValue(0),
      scan: vi.fn().mockResolvedValue(['0', []]),
      pipeline: vi.fn().mockReturnValue(pipeline),
      keys: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MomentsCacheInvalidationService,
        {
          provide: SupabaseService,
          useValue: { getRedisClient: vi.fn().mockReturnValue(redis) },
        },
      ],
    }).compile();

    service = module.get(MomentsCacheInvalidationService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defines explicit rules for follow, unfollow, removal and reset events', () => {
    expect(service.rules.map((rule) => rule.trigger)).toEqual([
      MomentsCacheInvalidationTrigger.USER_FOLLOWED,
      MomentsCacheInvalidationTrigger.USER_UNFOLLOWED,
      MomentsCacheInvalidationTrigger.MOMENT_REMOVED,
      MomentsCacheInvalidationTrigger.TIMELINE_RESET,
    ]);
  });

  it('invalidates only the affected follower timeline after a follow change', async () => {
    redis.del.mockResolvedValue(1);

    await service.handleUserFollowed({ followerId: 'user-1' });

    expect(redis.del).toHaveBeenCalledWith('timeline_queue:user-1');
    expect(redis.scan).not.toHaveBeenCalled();
  });

  it('invalidates only the affected follower timeline after an unfollow', async () => {
    redis.del.mockResolvedValue(1);

    await service.handleUserUnfollowed({ followerId: 'user-2' });

    expect(redis.del).toHaveBeenCalledWith('timeline_queue:user-2');
  });

  it('removes a withdrawn Moment from every timeline with bounded SCAN batches', async () => {
    redis.scan
      .mockResolvedValueOnce([
        '9',
        ['timeline_queue:user-1', 'timeline_queue:user-2'],
      ])
      .mockResolvedValueOnce(['0', ['timeline_queue:user-3']]);
    pipeline.exec
      .mockResolvedValueOnce([
        [null, 1],
        [null, 0],
      ])
      .mockResolvedValueOnce([[null, 1]]);

    const removed = await service.removeMomentFromAllTimelines('moment-7');

    expect(redis.scan).toHaveBeenNthCalledWith(
      1,
      '0',
      'MATCH',
      'timeline_queue:*',
      'COUNT',
      100,
    );
    expect(redis.scan).toHaveBeenNthCalledWith(
      2,
      '9',
      'MATCH',
      'timeline_queue:*',
      'COUNT',
      100,
    );
    expect(pipeline.lrem).toHaveBeenCalledWith(
      'timeline_queue:user-1',
      0,
      'moment-7',
    );
    expect(pipeline.lrem).toHaveBeenCalledWith(
      'timeline_queue:user-3',
      0,
      'moment-7',
    );
    expect(removed).toBe(2);
    expect(redis.keys).not.toHaveBeenCalled();
  });

  it('bulk invalidates timeline keys without using Redis KEYS', async () => {
    redis.scan
      .mockResolvedValueOnce(['4', ['timeline_queue:user-1']])
      .mockResolvedValueOnce([
        '0',
        ['timeline_queue:user-2', 'timeline_queue:user-3'],
      ]);
    redis.del.mockResolvedValueOnce(1).mockResolvedValueOnce(2);

    const deleted = await service.invalidateAllTimelines();

    expect(deleted).toBe(3);
    expect(redis.del).toHaveBeenNthCalledWith(1, 'timeline_queue:user-1');
    expect(redis.del).toHaveBeenNthCalledWith(
      2,
      'timeline_queue:user-2',
      'timeline_queue:user-3',
    );
    expect(redis.keys).not.toHaveBeenCalled();
  });

  it('routes the moment-removed event through surgical list-entry removal', async () => {
    redis.scan.mockResolvedValue(['0', ['timeline_queue:user-1']]);
    pipeline.exec.mockResolvedValue([[null, 1]]);

    await service.handleMomentRemoved({ momentId: 'moment-8' });

    expect(pipeline.lrem).toHaveBeenCalledWith(
      'timeline_queue:user-1',
      0,
      'moment-8',
    );
  });

  it('routes a reset event through bounded bulk invalidation', async () => {
    redis.scan.mockResolvedValue(['0', ['timeline_queue:user-1']]);
    redis.del.mockResolvedValue(1);

    await service.handleTimelineReset();

    expect(redis.scan).toHaveBeenCalledWith(
      '0',
      'MATCH',
      'timeline_queue:*',
      'COUNT',
      100,
    );
  });

  it('contains Redis failures and logs only a sanitized error classification', async () => {
    redis.del.mockRejectedValue(
      new Error('redis://user:secret@private-host timeline_queue:user-secret'),
    );

    await expect(service.invalidateUserTimeline('user-secret')).resolves.toBe(
      0,
    );

    expect(Logger.prototype.error).toHaveBeenCalledWith(
      'Moments user timeline invalidation failed (Error).',
    );
    expect(Logger.prototype.error.mock.calls.flat().join(' ')).not.toContain(
      'private-host',
    );
    expect(Logger.prototype.error.mock.calls.flat().join(' ')).not.toContain(
      'user-secret',
    );
  });
});
