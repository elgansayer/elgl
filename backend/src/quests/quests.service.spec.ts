import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { QuestsService } from './quests.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('QuestsService', () => {
  let service: QuestsService;
  let rpc: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    rpc = vi.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestsService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ rpc }) },
        },
      ],
    }).compile();

    service = module.get(QuestsService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads both daily and weekly quests through the authoritative RPC', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: 'daily-1',
          user_id: 'user-1',
          quest_type: 'daily',
          quest_key: 'correct_moments',
          progress: 2,
          target: 3,
          reward_coins: 5,
          completed: false,
          period_start: '2026-08-22',
          reward_claimed_at: null,
          created_at: '2026-08-22T00:00:00Z',
          updated_at: '2026-08-22T00:00:00Z',
        },
        {
          id: 'weekly-1',
          user_id: 'user-1',
          quest_type: 'weekly',
          quest_key: 'correct_moments',
          progress: 9,
          target: 10,
          reward_coins: 20,
          completed: false,
          period_start: '2026-08-17',
          reward_claimed_at: null,
          created_at: '2026-08-17T00:00:00Z',
          updated_at: '2026-08-22T00:00:00Z',
        },
      ],
      error: null,
    });

    const quests = await service.getQuests('user-1');

    expect(rpc).toHaveBeenCalledWith('get_or_create_user_quests', {
      p_user_id: 'user-1',
    });
    expect(quests).toHaveLength(2);
    expect(quests.map((quest) => quest.quest_type)).toEqual([
      'daily',
      'weekly',
    ]);
  });

  it('clamps corrupted progress in the read model', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: 'q1',
          user_id: 'user-1',
          quest_type: 'daily',
          quest_key: 'post_moment',
          progress: 999,
          target: 1,
          reward_coins: 5,
          completed: true,
          period_start: '2026-08-22',
          reward_claimed_at: '2026-08-22T10:00:00Z',
          created_at: '2026-08-22T00:00:00Z',
          updated_at: '2026-08-22T10:00:00Z',
        },
      ],
      error: null,
    });

    await expect(service.getQuests('user-1')).resolves.toEqual([
      expect.objectContaining({ progress: 1, target: 1 }),
    ]);
  });

  it('fails closed with a stable error when quests cannot be loaded', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'database detail' },
    });

    await expect(service.getQuests('user-1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('advances quest progress through one atomic database call', async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    await service.incrementProgress('user-1', 'correct_moments', 1);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('advance_user_quests', {
      p_user_id: 'user-1',
      p_quest_key: 'correct_moments',
      p_amount: 1,
    });
  });

  it.each([
    ['unknown', 1],
    ['post_moment', 0],
    ['post_moment', -1],
    ['post_moment', 101],
    ['post_moment', 1.5],
  ])('rejects invalid progress input (%s, %s)', async (questKey, amount) => {
    await expect(
      service.incrementProgress('user-1', questKey, amount),
    ).rejects.toThrow(BadRequestException);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('surfaces an atomic progress failure without retrying or awarding locally', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'transaction failed' },
    });

    await expect(
      service.incrementProgress('user-1', 'post_moment', 1),
    ).rejects.toThrow(InternalServerErrorException);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
