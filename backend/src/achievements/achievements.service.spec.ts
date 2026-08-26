import type { MockInstance } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
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
  let warnSpy: MockInstance;
  let errorSpy: MockInstance;

  beforeEach(async () => {
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
    it('seeds every milestone achievement via upsert', async () => {
      builders['achievements'] = makeBuilder({ error: null });

      await service.onModuleInit();

      expect(builders['achievements'].upsert).toHaveBeenCalledTimes(1);
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
    });

    it('logs a warning when seeding a milestone fails', async () => {
      builders['achievements'] = makeBuilder({
        error: { message: 'upsert failed' },
      });

      await service.onModuleInit();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to bulk upsert achievements'),
      );
    });
  });

  describe('awardAchievement', () => {
    it('inserts a user_achievements row when the achievement code exists', async () => {
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

    it('does nothing when the achievement code is unknown', async () => {
      builders['achievements'] = makeBuilder({ data: null, error: null });
      builders['user_achievements'] = makeBuilder({ error: null });

      await service.awardAchievement('user-1', 'nonexistent');

      expect(builders['user_achievements'].upsert).not.toHaveBeenCalled();
    });

    it('logs an error when the upsert into user_achievements fails', async () => {
      builders['achievements'] = makeBuilder({
        data: { id: 'ach-1' },
        error: null,
      });
      builders['user_achievements'] = makeBuilder({
        error: { message: 'insert failed' },
      });

      await service.awardAchievement('user-1', 'first_message');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to award achievement'),
      );
    });
  });

  describe('hasAchievement', () => {
    it('returns true when a matching user_achievements row exists', async () => {
      builders['achievements'] = makeBuilder({
        data: { id: 'ach-1' },
        error: null,
      });
      builders['user_achievements'] = makeBuilder({
        data: { id: 'row-1' },
        error: null,
      });

      await expect(
        service.hasAchievement('user-1', 'first_message'),
      ).resolves.toBe(true);
    });

    it('returns false when the achievement code is unknown', async () => {
      builders['achievements'] = makeBuilder({ data: null, error: null });

      await expect(
        service.hasAchievement('user-1', 'nonexistent'),
      ).resolves.toBe(false);
    });

    it('returns false when no matching user_achievements row exists', async () => {
      builders['achievements'] = makeBuilder({
        data: { id: 'ach-1' },
        error: null,
      });
      builders['user_achievements'] = makeBuilder({
        data: null,
        error: null,
      });

      await expect(
        service.hasAchievement('user-1', 'first_message'),
      ).resolves.toBe(false);
    });
  });

  describe('listAchievements', () => {
    it('returns achievement rows from supabase', async () => {
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

    it('returns an empty array when supabase returns no data', async () => {
      builders['achievements'] = makeBuilder({ data: null, error: null });

      await expect(service.listAchievements()).resolves.toEqual([]);
    });
  });

  describe('getUserAchievements', () => {
    it('returns the earned achievement rows for a user', async () => {
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
      expect(builders['user_achievements'].eq).toHaveBeenCalledWith(
        'user_id',
        'user-1',
      );
    });

    it('returns an empty array when supabase returns no data', async () => {
      builders['user_achievements'] = makeBuilder({
        data: null,
        error: null,
      });

      await expect(service.getUserAchievements('user-1')).resolves.toEqual([]);
    });
  });

  describe('getFullAchievements', () => {
    it('merges achievement definitions with earned status and current progress', async () => {
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
      builders['user_achievements'] = makeBuilder({
        data: [
          {
            achievements: {
              id: 'a1',
              code: 'first_message',
              name: 'First Message',
              description: 'desc',
            },
          },
        ],
        error: null,
      });
      builders['chat_messages'] = makeBuilder({ count: 5, error: null });
      builders['users'] = makeBuilder({
        data: { study_streak_days: 2 },
        error: null,
      });

      const result = await service.getFullAchievements('user-1');

      expect(result).toEqual([
        {
          code: 'first_message',
          name: 'First Message',
          description: 'Send your first message in a chat.',
          current: 5,
          required: 1,
          earned: true,
        },
      ]);
    });

    it('returns an empty array when there are no achievement definitions', async () => {
      builders['achievements'] = makeBuilder({ data: null, error: null });

      await expect(service.getFullAchievements('user-1')).resolves.toEqual([]);
    });

    it('reports streak-based progress and unearned status separately', async () => {
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

      const result = await service.getFullAchievements('user-1');

      expect(result).toEqual([
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
  });

  describe('evaluateAchievements', () => {
    it('awards achievements whose thresholds are met and are not already earned', async () => {
      builders['chat_messages'] = makeBuilder({ count: 100, error: null });
      builders['users'] = makeBuilder({
        data: { study_streak_days: 0 },
        error: null,
      });
      builders['user_achievements'] = makeBuilder({
        data: [],
        error: null,
      });

      const awardSpy = vi
        .spyOn(service, 'awardAchievement')
        .mockResolvedValue(undefined);

      await service.evaluateAchievements('user-1');

      expect(awardSpy).toHaveBeenCalledWith('user-1', 'first_message');
      expect(awardSpy).toHaveBeenCalledWith('user-1', '100_messages');
      expect(awardSpy).not.toHaveBeenCalledWith('user-1', '500_messages');
      expect(awardSpy).not.toHaveBeenCalledWith('user-1', '7_day_streak');
      expect(awardSpy).not.toHaveBeenCalledWith('user-1', '30_day_streak');
    });

    it('does not re-award achievements the user already holds', async () => {
      builders['chat_messages'] = makeBuilder({ count: 1, error: null });
      builders['users'] = makeBuilder({
        data: { study_streak_days: 0 },
        error: null,
      });
      builders['user_achievements'] = makeBuilder({
        data: [
          {
            achievements: { code: 'first_message' },
          },
        ],
        error: null,
      });

      const awardSpy = vi
        .spyOn(service, 'awardAchievement')
        .mockResolvedValue(undefined);

      await service.evaluateAchievements('user-1');

      expect(awardSpy).not.toHaveBeenCalled();
    });

    it('awards the 500-message and 30-day-streak milestones once thresholds are exceeded', async () => {
      builders['chat_messages'] = makeBuilder({ count: 500, error: null });
      builders['users'] = makeBuilder({
        data: { study_streak_days: 30 },
        error: null,
      });
      builders['user_achievements'] = makeBuilder({
        data: [],
        error: null,
      });

      const awardSpy = vi
        .spyOn(service, 'awardAchievement')
        .mockResolvedValue(undefined);

      await service.evaluateAchievements('user-1');

      expect(awardSpy).toHaveBeenCalledWith('user-1', 'first_message');
      expect(awardSpy).toHaveBeenCalledWith('user-1', '100_messages');
      expect(awardSpy).toHaveBeenCalledWith('user-1', '500_messages');
      expect(awardSpy).toHaveBeenCalledWith('user-1', '7_day_streak');
      expect(awardSpy).toHaveBeenCalledWith('user-1', '30_day_streak');
    });

    it('treats a message count lookup failure as zero messages', async () => {
      builders['chat_messages'] = makeBuilder({
        count: null,
        error: { message: 'db error' },
      });
      builders['users'] = makeBuilder({
        data: { study_streak_days: 0 },
        error: null,
      });
      builders['user_achievements'] = makeBuilder({
        data: [],
        error: null,
      });

      const awardSpy = vi
        .spyOn(service, 'awardAchievement')
        .mockResolvedValue(undefined);

      await service.evaluateAchievements('user-1');

      expect(awardSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get message count'),
      );
    });

    it('treats a streak lookup failure as a zero-day streak', async () => {
      builders['chat_messages'] = makeBuilder({ count: 0, error: null });
      builders['users'] = makeBuilder({
        data: null,
        error: { message: 'db error' },
      });
      builders['user_achievements'] = makeBuilder({
        data: [],
        error: null,
      });

      const awardSpy = vi
        .spyOn(service, 'awardAchievement')
        .mockResolvedValue(undefined);

      await service.evaluateAchievements('user-1');

      expect(awardSpy).not.toHaveBeenCalledWith('user-1', '7_day_streak');
      expect(awardSpy).not.toHaveBeenCalledWith('user-1', '30_day_streak');
    });
  });

  describe('handleEvaluationEvent', () => {
    it('delegates to evaluateAchievements with the event payload user id', async () => {
      const evaluateSpy = vi
        .spyOn(service, 'evaluateAchievements')
        .mockResolvedValue(undefined);

      await service.handleEvaluationEvent({ userId: 'user-1' });

      expect(evaluateSpy).toHaveBeenCalledWith('user-1');
    });
  });

  describe('handleMessageSent', () => {
    it('delegates to evaluateAchievements with the event payload user id', async () => {
      const evaluateSpy = vi
        .spyOn(service, 'evaluateAchievements')
        .mockResolvedValue(undefined);

      await service.handleMessageSent({ userId: 'user-1' });

      expect(evaluateSpy).toHaveBeenCalledWith('user-1');
    });
  });
});
