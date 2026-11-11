import type { MockInstance } from 'vitest';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AchievementsService, MILESTONES } from './achievements.service';
import { SupabaseService } from '../supabase/supabase.service';

function makeBuilder(response: unknown) {
  const builder: any = {};
  for (const method of [
    'select',
    'eq',
    'not',
    'gte',
    'lt',
    'order',
    'limit',
    'single',
    'returns',
    'upsert',
  ]) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.then = (
    resolve: (value: unknown) => void,
    reject?: (reason: unknown) => void,
  ) => Promise.resolve(response).then(resolve, reject);
  return builder;
}

describe('AchievementsService', () => {
  let service: AchievementsService;
  let builders: Record<string, any>;
  let mockSupabaseClient: any;
  let logSpy: MockInstance;
  let warnSpy: MockInstance;
  let errorSpy: MockInstance;

  beforeEach(async () => {
    logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    builders = {};
    mockSupabaseClient = {
      from: vi.fn((table: string) => builders[table]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AchievementsService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<AchievementsService>(AchievementsService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('seeds every supported milestone from the canonical catalogue', async () => {
      builders['achievements'] = makeBuilder({ error: null });

      await service.onModuleInit();

      expect(builders['achievements'].upsert).toHaveBeenCalledWith(
        MILESTONES.map(({ code, name, description }) => ({
          code,
          name,
          description,
        })),
        { onConflict: 'code' },
      );
      expect(logSpy).toHaveBeenCalledWith('achievements.seed_complete');
    });

    it('keeps the unlock thresholds and progress sources stable', () => {
      expect(
        MILESTONES.map(({ code, source, required }) => [
          code,
          source,
          required,
        ]),
      ).toEqual([
        ['first_message', 'messages', 1],
        ['100_messages', 'messages', 100],
        ['500_messages', 'messages', 500],
        ['7_day_streak', 'streak', 7],
        ['30_day_streak', 'streak', 30],
        ['first_correction', 'corrections', 1],
        ['25_corrections', 'corrections', 25],
        ['100_corrections', 'corrections', 100],
        ['first_moment', 'moments', 1],
        ['10_moments', 'moments', 10],
        ['first_lesson', 'lessons', 1],
        ['10_lessons', 'lessons', 10],
      ]);
      expect(new Set(MILESTONES.map(({ code }) => code)).size).toBe(
        MILESTONES.length,
      );
    });

    it('reports a sanitized degraded state when seeding fails', async () => {
      builders['achievements'] = makeBuilder({
        error: { message: 'sensitive provider detail' },
      });

      await service.onModuleInit();

      expect(warnSpy).toHaveBeenCalledWith('achievements.seed_failed');
      expect(logSpy).not.toHaveBeenCalledWith('achievements.seed_complete');
      expect(warnSpy.mock.calls.flat().join(' ')).not.toContain(
        'sensitive provider detail',
      );
    });
  });

  describe('awardAchievement', () => {
    it('uses the unique user/achievement upsert contract for retry safety', async () => {
      builders['achievements'] = makeBuilder({
        data: { id: 'ach-1' },
        error: null,
      });
      builders['user_achievements'] = makeBuilder({ error: null });

      await service.awardAchievement('user-1', 'first_message');

      expect(builders['user_achievements'].upsert).toHaveBeenCalledWith(
        { user_id: 'user-1', achievement_id: 'ach-1' },
        { onConflict: 'user_id,achievement_id' },
      );
    });

    it('does nothing when an internal achievement code is unknown', async () => {
      builders['achievements'] = makeBuilder({ data: null, error: null });
      builders['user_achievements'] = makeBuilder({ error: null });

      await service.awardAchievement('user-1', 'nonexistent');

      expect(builders['user_achievements'].upsert).not.toHaveBeenCalled();
    });

    it('fails closed and does not log user/provider data when persistence fails', async () => {
      builders['achievements'] = makeBuilder({
        data: { id: 'ach-1' },
        error: null,
      });
      builders['user_achievements'] = makeBuilder({
        error: { message: 'database secret' },
      });

      await expect(
        service.awardAchievement('private-user-id', 'first_message'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      const logs = errorSpy.mock.calls.flat().join(' ');
      expect(logs).toContain('achievements.award_write_failed');
      expect(logs).not.toContain('private-user-id');
      expect(logs).not.toContain('database secret');
    });
  });

  describe('read APIs', () => {
    it('returns achievement definitions from Supabase', async () => {
      const rows = [
        {
          id: 'a1',
          code: 'first_message',
          name: 'First Message',
          description: 'desc',
        },
      ];
      builders['achievements'] = makeBuilder({ data: rows, error: null });

      await expect(service.listAchievements()).resolves.toEqual(rows);
    });

    it('returns earned achievements for the requested user', async () => {
      const rows = [
        {
          achievements: {
            id: 'a1',
            code: 'first_message',
            name: 'First Message',
            description: 'desc',
          },
        },
      ];
      builders['user_achievements'] = makeBuilder({ data: rows, error: null });

      await expect(service.getUserAchievements('user-1')).resolves.toEqual(
        rows,
      );
    });

    it('distinguishes an empty result from an unavailable earned-badge store', async () => {
      builders['user_achievements'] = makeBuilder({
        data: null,
        error: { message: 'provider failed' },
      });

      await expect(
        service.getUserAchievements('user-1'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(errorSpy).toHaveBeenCalledWith('achievements.earned_read_failed');
    });
  });

  describe('getUnlockedBetween', () => {
    const start = new Date('2026-11-03T00:00:00.000Z');
    const end = new Date('2026-11-10T00:00:00.000Z');

    it('returns the caller badges unlocked in the window, newest first and bounded', async () => {
      builders['user_achievements'] = makeBuilder({
        data: [
          {
            unlocked_at: '2026-11-09T10:00:00.000Z',
            achievements: {
              code: 'first_moment',
              name: 'First Moment',
              description: null,
            },
          },
          {
            unlocked_at: null,
            achievements: {
              code: 'first_lesson',
              name: 'First Lesson',
              description: 'd',
            },
          },
          { unlocked_at: '2026-11-08T10:00:00.000Z', achievements: null },
        ],
        error: null,
      });

      await expect(
        service.getUnlockedBetween('user-1', start, end),
      ).resolves.toEqual([
        {
          code: 'first_moment',
          name: 'First Moment',
          description: '',
          unlocked_at: '2026-11-09T10:00:00.000Z',
        },
      ]);

      const builder = builders['user_achievements'];
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(builder.gte).toHaveBeenCalledWith(
        'unlocked_at',
        '2026-11-03T00:00:00.000Z',
      );
      expect(builder.lt).toHaveBeenCalledWith(
        'unlocked_at',
        '2026-11-10T00:00:00.000Z',
      );
      expect(builder.order).toHaveBeenCalledWith('unlocked_at', {
        ascending: false,
      });
      expect(builder.limit).toHaveBeenCalledWith(50);
    });

    it('returns an empty list when nothing was unlocked', async () => {
      builders['user_achievements'] = makeBuilder({ data: null, error: null });

      await expect(
        service.getUnlockedBetween('user-1', start, end),
      ).resolves.toEqual([]);
    });

    it('fails closed with a sanitized log when the earned store is unavailable', async () => {
      builders['user_achievements'] = makeBuilder({
        data: null,
        error: { message: 'provider secret' },
      });

      await expect(
        service.getUnlockedBetween('private-user-id', start, end),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(errorSpy).toHaveBeenCalledWith(
        'achievements.unlocked_read_failed',
      );
      const logs = errorSpy.mock.calls.flat().join(' ');
      expect(logs).not.toContain('private-user-id');
      expect(logs).not.toContain('provider secret');
    });

    it('fails closed when the query throws', async () => {
      builders['user_achievements'] = undefined;

      await expect(
        service.getUnlockedBetween('user-1', start, end),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('getFullAchievements', () => {
    it('merges canonical message thresholds with earned status and progress', async () => {
      builders['achievements'] = makeBuilder({
        data: [
          {
            code: '100_messages',
            name: '100 Messages',
            description: 'Send 100 messages in chats.',
          },
        ],
        error: null,
      });
      builders['user_achievements'] = makeBuilder({
        data: [
          {
            achievements: {
              id: 'a1',
              code: '100_messages',
              name: '100 Messages',
              description: 'desc',
            },
          },
        ],
        error: null,
      });
      builders['chat_messages'] = makeBuilder({ count: 125, error: null });
      builders['users'] = makeBuilder({
        data: { study_streak_days: 2 },
        error: null,
      });

      await expect(service.getFullAchievements('user-1')).resolves.toEqual([
        {
          code: '100_messages',
          name: '100 Messages',
          description: 'Send 100 messages in chats.',
          current: 125,
          required: 100,
          earned: true,
        },
      ]);
    });

    it('reports streak progress from the same canonical milestone catalogue', async () => {
      builders['achievements'] = makeBuilder({
        data: [
          {
            code: '7_day_streak',
            name: '7-Day Streak',
            description: 'Keep a 7-day study streak.',
          },
        ],
        error: null,
      });
      builders['user_achievements'] = makeBuilder({ data: [], error: null });
      builders['chat_messages'] = makeBuilder({ count: 0, error: null });
      builders['users'] = makeBuilder({
        data: { study_streak_days: 3 },
        error: null,
      });

      await expect(service.getFullAchievements('user-1')).resolves.toEqual([
        {
          code: '7_day_streak',
          name: '7-Day Streak',
          description: 'Keep a 7-day study streak.',
          current: 3,
          required: 7,
          earned: false,
        },
      ]);
    });

    it('skips completed progress queries without reporting earned milestones as empty', async () => {
      const definitions = [
        {
          code: 'first_message',
          name: 'First Message',
          description: 'Send your first message in a chat.',
        },
        {
          code: '100_messages',
          name: '100 Messages',
          description: 'Send 100 messages in chats.',
        },
        {
          code: '500_messages',
          name: '500 Messages',
          description: 'Send 500 messages in chats.',
        },
        {
          code: '7_day_streak',
          name: '7-Day Streak',
          description: 'Keep a 7-day study streak.',
        },
        {
          code: '30_day_streak',
          name: '30-Day Streak',
          description: 'Keep a 30-day study streak.',
        },
      ];
      builders['achievements'] = makeBuilder({
        data: definitions,
        error: null,
      });
      builders['user_achievements'] = makeBuilder({
        data: definitions.map((achievement) => ({
          achievements: achievement,
        })),
        error: null,
      });

      const achievements = await service.getFullAchievements('user-1');

      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('chat_messages');
      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('users');
      expect(achievements).toEqual([
        expect.objectContaining({
          code: 'first_message',
          current: 500,
          earned: true,
        }),
        expect.objectContaining({
          code: '100_messages',
          current: 500,
          earned: true,
        }),
        expect.objectContaining({
          code: '500_messages',
          current: 500,
          earned: true,
        }),
        expect.objectContaining({
          code: '7_day_streak',
          current: 30,
          earned: true,
        }),
        expect.objectContaining({
          code: '30_day_streak',
          current: 30,
          earned: true,
        }),
      ]);
    });

    it('reports corrections, moments and lessons progress from their own sources', async () => {
      builders['achievements'] = makeBuilder({
        data: [
          { code: '25_corrections', name: '25 Corrections', description: 'c' },
          { code: '10_moments', name: '10 Moments', description: 'm' },
          { code: 'first_lesson', name: 'First Lesson', description: 'l' },
        ],
        error: null,
      });
      builders['user_achievements'] = makeBuilder({
        data: [{ achievements: { code: 'first_lesson' } }],
        error: null,
      });
      builders['moment_comments'] = makeBuilder({ count: 12, error: null });
      builders['moments'] = makeBuilder({ count: 4, error: null });
      builders['lesson_progress'] = makeBuilder({ count: 3, error: null });

      await expect(service.getFullAchievements('user-1')).resolves.toEqual([
        {
          code: '25_corrections',
          name: '25 Corrections',
          description: 'c',
          current: 12,
          required: 25,
          earned: false,
        },
        {
          code: '10_moments',
          name: '10 Moments',
          description: 'm',
          current: 4,
          required: 10,
          earned: false,
        },
        {
          code: 'first_lesson',
          name: 'First Lesson',
          description: 'l',
          current: 3,
          required: 1,
          earned: true,
        },
      ]);
      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('chat_messages');
      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('users');
    });

    it('keeps a catalogue row without a milestone definition visible without progress queries', async () => {
      builders['achievements'] = makeBuilder({
        data: [{ code: 'legacy_badge', name: 'Legacy', description: null }],
        error: null,
      });
      builders['user_achievements'] = makeBuilder({
        data: [{ achievements: { code: 'legacy_badge' } }],
        error: null,
      });

      await expect(service.getFullAchievements('user-1')).resolves.toEqual([
        {
          code: 'legacy_badge',
          name: 'Legacy',
          description: '',
          current: 0,
          required: 0,
          earned: true,
        },
      ]);
      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('chat_messages');
      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('moments');
    });

    it('returns an empty array only when the catalogue is genuinely empty', async () => {
      builders['achievements'] = makeBuilder({ data: null, error: null });

      await expect(service.getFullAchievements('user-1')).resolves.toEqual([]);
    });

    it('fails closed instead of presenting zero progress during a source outage', async () => {
      builders['achievements'] = makeBuilder({
        data: [
          {
            code: 'first_message',
            name: 'First Message',
            description: 'Send your first message in a chat.',
          },
        ],
        error: null,
      });
      builders['user_achievements'] = makeBuilder({ data: [], error: null });
      builders['chat_messages'] = makeBuilder({
        count: null,
        error: { message: 'provider failed' },
      });
      builders['users'] = makeBuilder({
        data: { study_streak_days: 0 },
        error: null,
      });

      await expect(
        service.getFullAchievements('user-1'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(errorSpy).toHaveBeenCalledWith(
        'achievements.message_count_failed',
      );
    });
  });

  describe('evaluateAchievements', () => {
    beforeEach(() => {
      builders['moment_comments'] = makeBuilder({ count: 0, error: null });
      builders['moments'] = makeBuilder({ count: 0, error: null });
      builders['lesson_progress'] = makeBuilder({ count: 0, error: null });
    });

    it('awards every due milestone once thresholds are met', async () => {
      builders['chat_messages'] = makeBuilder({ count: 100, error: null });
      builders['users'] = makeBuilder({
        data: { study_streak_days: 7 },
        error: null,
      });
      builders['user_achievements'] = makeBuilder({ data: [], error: null });

      const awardSpy = vi
        .spyOn(service, 'awardAchievement')
        .mockResolvedValue(undefined);

      await service.evaluateAchievements('user-1');

      expect(awardSpy).toHaveBeenCalledWith('user-1', 'first_message');
      expect(awardSpy).toHaveBeenCalledWith('user-1', '100_messages');
      expect(awardSpy).toHaveBeenCalledWith('user-1', '7_day_streak');
      expect(awardSpy).not.toHaveBeenCalledWith('user-1', '500_messages');
      expect(awardSpy).not.toHaveBeenCalledWith('user-1', '30_day_streak');
    });

    it('does not re-award milestones the user already holds', async () => {
      builders['chat_messages'] = makeBuilder({ count: 1, error: null });
      builders['users'] = makeBuilder({
        data: { study_streak_days: 0 },
        error: null,
      });
      builders['user_achievements'] = makeBuilder({
        data: [{ achievements: { code: 'first_message' } }],
        error: null,
      });

      const awardSpy = vi
        .spyOn(service, 'awardAchievement')
        .mockResolvedValue(undefined);

      await service.evaluateAchievements('user-1');

      expect(awardSpy).not.toHaveBeenCalled();
    });

    it('aborts evaluation when a progress source is unavailable', async () => {
      builders['chat_messages'] = makeBuilder({
        count: null,
        error: { message: 'db error' },
      });
      builders['users'] = makeBuilder({
        data: { study_streak_days: 30 },
        error: null,
      });
      builders['user_achievements'] = makeBuilder({ data: [], error: null });

      const awardSpy = vi
        .spyOn(service, 'awardAchievement')
        .mockResolvedValue(undefined);

      await expect(
        service.evaluateAchievements('user-1'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(awardSpy).not.toHaveBeenCalled();
    });

    it('waits for all independent awards and exposes partial persistence failure', async () => {
      builders['chat_messages'] = makeBuilder({ count: 100, error: null });
      builders['users'] = makeBuilder({
        data: { study_streak_days: 0 },
        error: null,
      });
      builders['user_achievements'] = makeBuilder({ data: [], error: null });

      const attempted: string[] = [];
      vi.spyOn(service, 'awardAchievement').mockImplementation(
        async (_userId, code) => {
          attempted.push(code);
          if (code === 'first_message') {
            throw new ServiceUnavailableException();
          }
        },
      );

      await expect(
        service.evaluateAchievements('user-1'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(attempted).toEqual(
        expect.arrayContaining(['first_message', '100_messages']),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'achievements.award_batch_failed count=1',
      );
    });

    it('awards corrections, moments and lessons badges from persisted counts', async () => {
      builders['chat_messages'] = makeBuilder({ count: 0, error: null });
      builders['users'] = makeBuilder({
        data: { study_streak_days: 0 },
        error: null,
      });
      builders['user_achievements'] = makeBuilder({ data: [], error: null });
      builders['moment_comments'] = makeBuilder({ count: 25, error: null });
      builders['moments'] = makeBuilder({ count: 10, error: null });
      builders['lesson_progress'] = makeBuilder({ count: 1, error: null });
      const awardSpy = vi
        .spyOn(service, 'awardAchievement')
        .mockResolvedValue(undefined);

      await service.evaluateAchievements('user-1');

      expect(awardSpy.mock.calls.map(([, code]) => code).sort()).toEqual(
        [
          '10_moments',
          '25_corrections',
          'first_correction',
          'first_lesson',
          'first_moment',
        ].sort(),
      );
    });

    it('counts only corrections and only completed lessons', async () => {
      builders['user_achievements'] = makeBuilder({ data: [], error: null });
      vi.spyOn(service, 'awardAchievement').mockResolvedValue(undefined);

      await service.evaluateAchievements('user-1', ['corrections', 'lessons']);

      expect(builders['moment_comments'].eq).toHaveBeenCalledWith(
        'user_id',
        'user-1',
      );
      expect(builders['moment_comments'].not).toHaveBeenCalledWith(
        'correction_payload',
        'is',
        null,
      );
      expect(builders['lesson_progress'].eq).toHaveBeenCalledWith(
        'user_id',
        'user-1',
      );
      expect(builders['lesson_progress'].eq).toHaveBeenCalledWith(
        'completed',
        true,
      );
    });

    it('only queries the requested sources', async () => {
      builders['user_achievements'] = makeBuilder({ data: [], error: null });
      vi.spyOn(service, 'awardAchievement').mockResolvedValue(undefined);

      await service.evaluateAchievements('user-1', ['moments']);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('moments');
      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('chat_messages');
      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('users');
      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith(
        'moment_comments',
      );
      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith(
        'lesson_progress',
      );
    });

    it.each([
      [
        'corrections',
        'moment_comments',
        'achievements.correction_count_failed',
      ],
      ['moments', 'moments', 'achievements.moment_count_failed'],
      ['lessons', 'lesson_progress', 'achievements.lesson_count_failed'],
    ] as const)(
      'fails closed with a sanitized log when the %s source is unavailable',
      async (source, table, logLine) => {
        builders['user_achievements'] = makeBuilder({ data: [], error: null });
        builders[table] = makeBuilder({
          count: null,
          error: { message: 'provider secret' },
        });
        const awardSpy = vi
          .spyOn(service, 'awardAchievement')
          .mockResolvedValue(undefined);

        await expect(
          service.evaluateAchievements('private-user-id', [source]),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);

        expect(awardSpy).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith(logLine);
        const logs = errorSpy.mock.calls.flat().join(' ');
        expect(logs).not.toContain('private-user-id');
        expect(logs).not.toContain('provider secret');
      },
    );

    it('lets concurrent evaluations race safely through the unique upsert', async () => {
      builders['achievements'] = makeBuilder({
        data: { id: 'ach-1' },
        error: null,
      });
      builders['user_achievements'] = makeBuilder({ data: [], error: null });
      builders['moments'] = makeBuilder({ count: 1, error: null });

      await Promise.all([
        service.evaluateAchievements('user-1', ['moments']),
        service.evaluateAchievements('user-1', ['moments']),
      ]);

      const upserts = builders['user_achievements'].upsert.mock.calls;
      expect(upserts).toHaveLength(2);
      for (const [row, options] of upserts) {
        expect(row).toEqual({ user_id: 'user-1', achievement_id: 'ach-1' });
        expect(options).toEqual({ onConflict: 'user_id,achievement_id' });
      }
    });

    it('fails closed when a progress query throws synchronously', async () => {
      builders['user_achievements'] = makeBuilder({ data: [], error: null });
      builders['moments'] = undefined;

      await expect(
        service.evaluateAchievements('user-1', ['moments']),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(errorSpy).toHaveBeenCalledWith('achievements.moment_count_failed');
    });
  });

  describe('event integration', () => {
    it('evaluates on message and explicit achievement events', async () => {
      const evaluateSpy = vi
        .spyOn(service, 'evaluateAchievements')
        .mockResolvedValue(undefined);

      await service.handleMessageSent({ userId: 'user-1' });
      await service.handleEvaluationEvent({ userId: 'user-2' });
      await service.handleEvaluationEvent({
        userId: 'user-3',
        sources: ['moments'],
      });

      expect(evaluateSpy).toHaveBeenNthCalledWith(1, 'user-1', [
        'messages',
        'streak',
      ]);
      expect(evaluateSpy).toHaveBeenNthCalledWith(2, 'user-2', undefined);
      expect(evaluateSpy).toHaveBeenNthCalledWith(3, 'user-3', ['moments']);
    });

    it('contains background evaluation failures so the source action still succeeds', async () => {
      vi.spyOn(service, 'evaluateAchievements').mockRejectedValue(
        new ServiceUnavailableException(),
      );

      await expect(
        service.handleMessageSent({ userId: 'private-user-id' }),
      ).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalledWith(
        'achievements.event_evaluation_failed',
      );
      expect(warnSpy.mock.calls.flat().join(' ')).not.toContain(
        'private-user-id',
      );
    });
  });
});
