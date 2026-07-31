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
    builder[method] = jest.fn().mockReturnValue(builder);
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

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    builders = {};
    mockSupabaseClient = {
      from: jest.fn((table: string) => builders[table]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AchievementsService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<AchievementsService>(AchievementsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
  });

  describe('evaluateAchievements', () => {
    it('awards achievements whose thresholds are met and are not already earned', async () => {
      builders['chat_messages'] = makeBuilder({ count: 100, error: null });
      builders['users'] = makeBuilder({
        data: { study_streak_days: 0 },
        error: null,
      });

      jest.spyOn(service, 'hasAchievement').mockResolvedValue(false);
      const awardSpy = jest
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

      jest.spyOn(service, 'hasAchievement').mockResolvedValue(true);
      const awardSpy = jest
        .spyOn(service, 'awardAchievement')
        .mockResolvedValue(undefined);

      await service.evaluateAchievements('user-1');

      expect(awardSpy).not.toHaveBeenCalled();
    });
  });
});
