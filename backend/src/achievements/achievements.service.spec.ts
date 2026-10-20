import type { MockInstance } from 'vitest';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AchievementsService } from './achievements.service';
import { SupabaseService } from '../supabase/supabase.service';

function makeBuilder(response: unknown) {
  const builder: any = {};
  for (const method of [
    'select',
    'eq',
    'order',
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
        [
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
            description: 'Keep a 7‑day study streak.',
          },
          {
            code: '30_day_streak',
            name: '30-Day Streak',
            description: 'Keep a 30‑day study streak.',
          },
        ],
        { onConflict: 'code' },
      );
      expect(logSpy).toHaveBeenCalledWith('achievements.seed_complete');
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
  });

  describe('event integration', () => {
    it('evaluates on message and explicit achievement events', async () => {
      const evaluateSpy = vi
        .spyOn(service, 'evaluateAchievements')
        .mockResolvedValue(undefined);

      await service.handleMessageSent({ userId: 'user-1' });
      await service.handleEvaluationEvent({ userId: 'user-2' });

      expect(evaluateSpy).toHaveBeenNthCalledWith(1, 'user-1');
      expect(evaluateSpy).toHaveBeenNthCalledWith(2, 'user-2');
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
