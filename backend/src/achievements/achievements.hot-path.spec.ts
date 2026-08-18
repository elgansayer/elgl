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

describe('AchievementsService hot-path evaluation', () => {
  let service: AchievementsService;
  let builders: Record<string, any>;
  let mockSupabaseClient: { from: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
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

  it('skips the lifetime message count after all message milestones are earned', async () => {
    builders['user_achievements'] = makeBuilder({
      data: [
        { achievements: { code: 'first_message' } },
        { achievements: { code: '100_messages' } },
        { achievements: { code: '500_messages' } },
      ],
      error: null,
    });
    builders['chat_messages'] = makeBuilder({ count: 9999, error: null });
    builders['users'] = makeBuilder({
      data: { study_streak_days: 0 },
      error: null,
    });
    const awardSpy = vi
      .spyOn(service, 'awardAchievement')
      .mockResolvedValue(undefined);

    await service.evaluateAchievements('user-1');

    expect(builders['chat_messages'].select).not.toHaveBeenCalled();
    expect(builders['users'].select).toHaveBeenCalledWith('study_streak_days');
    expect(awardSpy).not.toHaveBeenCalled();
  });

  it('skips the streak lookup after all streak milestones are earned', async () => {
    builders['user_achievements'] = makeBuilder({
      data: [
        { achievements: { code: '7_day_streak' } },
        { achievements: { code: '30_day_streak' } },
      ],
      error: null,
    });
    builders['chat_messages'] = makeBuilder({ count: 100, error: null });
    builders['users'] = makeBuilder({
      data: { study_streak_days: 100 },
      error: null,
    });
    const awardSpy = vi
      .spyOn(service, 'awardAchievement')
      .mockResolvedValue(undefined);

    await service.evaluateAchievements('user-1');

    expect(builders['chat_messages'].select).toHaveBeenCalled();
    expect(builders['users'].select).not.toHaveBeenCalled();
    expect(awardSpy).toHaveBeenCalledWith('user-1', 'first_message');
    expect(awardSpy).toHaveBeenCalledWith('user-1', '100_messages');
    expect(awardSpy).not.toHaveBeenCalledWith('user-1', '500_messages');
  });

  it('uses only the bounded earned-state query when every milestone is already earned', async () => {
    builders['user_achievements'] = makeBuilder({
      data: [
        { achievements: { code: 'first_message' } },
        { achievements: { code: '100_messages' } },
        { achievements: { code: '500_messages' } },
        { achievements: { code: '7_day_streak' } },
        { achievements: { code: '30_day_streak' } },
      ],
      error: null,
    });
    const awardSpy = vi
      .spyOn(service, 'awardAchievement')
      .mockResolvedValue(undefined);

    await service.evaluateAchievements('user-1');

    expect(mockSupabaseClient.from).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_achievements');
    expect(awardSpy).not.toHaveBeenCalled();
  });
});
