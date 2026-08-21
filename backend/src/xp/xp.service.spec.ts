import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException, Logger } from '@nestjs/common';
import { XpService } from './xp.service';
import { SupabaseService } from '../supabase/supabase.service';

function makeBuilder(response: unknown) {
  const builder: any = {};
  for (const method of ['insert', 'select', 'eq', 'order', 'range']) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.then = (
    resolve: (value: unknown) => void,
    reject?: (reason: unknown) => void,
  ) => Promise.resolve(response).then(resolve, reject);
  return builder;
}

describe('XpService', () => {
  let service: XpService;
  let mockSupabaseClient: any;
  let mockSupabaseService: {
    incrementXp: Mock;
    getUserXp: Mock;
    getClient: Mock;
  };
  let xpEventsBuilder: any;

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    xpEventsBuilder = makeBuilder({ error: null });
    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(xpEventsBuilder),
    };
    mockSupabaseService = {
      incrementXp: vi.fn().mockResolvedValue(undefined),
      getUserXp: vi.fn().mockResolvedValue(0),
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        XpService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<XpService>(XpService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('awardXpForActivity', () => {
    it('increments xp and logs an xp_events row for a known activity', async () => {
      await service.awardXpForActivity('user-1', 'complete_lesson');

      expect(mockSupabaseService.incrementXp).toHaveBeenCalledWith(
        'user-1',
        10,
      );
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('xp_events');
      expect(xpEventsBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          points: 10,
          activity: 'complete_lesson',
        }),
      );
    });

    it('does nothing for an unknown activity', async () => {
      await service.awardXpForActivity('user-1', 'unknown_activity');

      expect(mockSupabaseService.incrementXp).not.toHaveBeenCalled();
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('logs a warning when the xp_events insert fails', async () => {
      xpEventsBuilder = makeBuilder({ error: { message: 'insert failed' } });
      mockSupabaseClient.from.mockReturnValue(xpEventsBuilder);
      const warnSpy = vi.spyOn(Logger.prototype, 'warn');

      await service.awardXpForActivity('user-1', 'create_moment');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to log XP event for user user-1'),
      );
    });
  });

  describe('getTotalXp / getXpTotal', () => {
    it('getTotalXp delegates to SupabaseService.getUserXp', async () => {
      mockSupabaseService.getUserXp.mockResolvedValue(250);

      await expect(service.getTotalXp('user-1')).resolves.toBe(250);
      expect(mockSupabaseService.getUserXp).toHaveBeenCalledWith('user-1');
    });

    it('getXpTotal delegates to getTotalXp', async () => {
      mockSupabaseService.getUserXp.mockResolvedValue(75);

      await expect(service.getXpTotal('user-1')).resolves.toBe(75);
    });
  });

  describe('getXpHistory', () => {
    const rows = [
      {
        id: 'e1',
        user_id: 'user-1',
        points: 5,
        activity: 'create_flashcard',
        created_at: '2026-08-01T00:00:00Z',
      },
    ];

    it('queries with default limit and offset and returns data', async () => {
      xpEventsBuilder = makeBuilder({ data: rows, error: null });
      mockSupabaseClient.from.mockReturnValue(xpEventsBuilder);

      const result = await service.getXpHistory('user-1');

      expect(xpEventsBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(xpEventsBuilder.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
      expect(xpEventsBuilder.range).toHaveBeenCalledWith(0, 49);
      expect(result).toEqual(rows);
    });

    it('applies explicit limit and offset to the range query', async () => {
      xpEventsBuilder = makeBuilder({ data: rows, error: null });
      mockSupabaseClient.from.mockReturnValue(xpEventsBuilder);

      await service.getXpHistory('user-1', 10, 20);

      expect(xpEventsBuilder.range).toHaveBeenCalledWith(20, 29);
    });

    it('returns an empty array when data is null', async () => {
      xpEventsBuilder = makeBuilder({ data: null, error: null });
      mockSupabaseClient.from.mockReturnValue(xpEventsBuilder);

      await expect(service.getXpHistory('user-1')).resolves.toEqual([]);
    });

    it('throws InternalServerErrorException when supabase returns an error', async () => {
      xpEventsBuilder = makeBuilder({
        data: null,
        error: { message: 'query failed' },
      });
      mockSupabaseClient.from.mockReturnValue(xpEventsBuilder);

      await expect(service.getXpHistory('user-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getActivityPoints', () => {
    it('returns a copy of the activity points map', () => {
      const points = service.getActivityPoints();

      expect(points).toEqual({
        create_flashcard: 5,
        review_flashcard: 2,
        complete_lesson: 10,
        create_moment: 3,
        follow_language_partner: 2,
      });

      points.create_flashcard = 999;
      expect(service.getActivityPoints().create_flashcard).toBe(5);
    });
  });

  describe('getPointsForActivity', () => {
    it('returns the points for a known activity', () => {
      expect(service.getPointsForActivity('review_flashcard')).toBe(2);
    });

    it('returns 0 for an unknown activity', () => {
      expect(service.getPointsForActivity('not_a_real_activity')).toBe(0);
    });
  });

  describe('awardXp', () => {
    it('increments xp and logs an xp_events row when points are positive', async () => {
      await service.awardXp('user-1', 'bonus', 15);

      expect(mockSupabaseService.incrementXp).toHaveBeenCalledWith(
        'user-1',
        15,
      );
      expect(xpEventsBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          points: 15,
          activity: 'bonus',
        }),
      );
    });

    it('does nothing when points default to 0', async () => {
      await service.awardXp('user-1', 'bonus');

      expect(mockSupabaseService.incrementXp).not.toHaveBeenCalled();
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('does nothing when points are negative', async () => {
      await service.awardXp('user-1', 'bonus', -5);

      expect(mockSupabaseService.incrementXp).not.toHaveBeenCalled();
    });

    it('logs a warning when the xp_events insert fails', async () => {
      xpEventsBuilder = makeBuilder({ error: { message: 'insert failed' } });
      mockSupabaseClient.from.mockReturnValue(xpEventsBuilder);
      const warnSpy = vi.spyOn(Logger.prototype, 'warn');

      await service.awardXp('user-1', 'bonus', 15);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to log XP event for user user-1'),
      );
    });
  });

  describe('getLevel', () => {
    it('computes level as floor(xp / 100) + 1', async () => {
      mockSupabaseService.getUserXp.mockResolvedValue(250);

      await expect(service.getLevel('user-1')).resolves.toBe(3);
    });

    it('returns level 1 for a user with no xp', async () => {
      mockSupabaseService.getUserXp.mockResolvedValue(0);

      await expect(service.getLevel('user-1')).resolves.toBe(1);
    });
  });
});
