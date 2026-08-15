import { vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { QuestsService } from './quests.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';

describe('QuestsService', () => {
  let service: QuestsService;
  let supabaseService: SupabaseService;
  let usersService: UsersService;

  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    then: vi.fn(),
  };

  mockQueryBuilder.then.mockImplementation((res, rej) => {
    return Promise.resolve({ data: null, error: null }).then(res, rej);
  });

  const mockSupabaseClient = {
    from: vi.fn().mockReturnValue(mockQueryBuilder),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestsService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: UsersService,
          useValue: {
            awardCoins: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(QuestsService);
    supabaseService = module.get(SupabaseService);
    usersService = module.get(UsersService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDailyQuests', () => {
    it('should initialize missing quests using optimized bulk insert', async () => {
      // Mock for user_quests query returning no initial data
      mockQueryBuilder.then.mockImplementationOnce((res, rej) => {
        return Promise.resolve({ data: [] }).then(res, rej);
      });
      // Mock for bulk fetch of existing quests
      mockQueryBuilder.then.mockImplementationOnce((res, rej) => {
        return Promise.resolve({ data: [] }).then(res, rej);
      });
      // Mock for bulk insert (doesn't return data)
      mockQueryBuilder.then.mockImplementationOnce((res, rej) => {
        return Promise.resolve({ data: null }).then(res, rej);
      });
      // Mock for fetching quests after insert
      const mockInsertedData = [
        {
          id: '1',
          quest_type: 'daily',
          quest_key: 'correct_moments',
          progress: 0,
          target: 3,
        },
      ];
      mockQueryBuilder.then.mockImplementationOnce((res, rej) => {
        return Promise.resolve({ data: mockInsertedData }).then(res, rej);
      });

      const res = await service.getDailyQuests('user1');

      expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(1);
      const insertedArgs = mockQueryBuilder.insert.mock.calls[0][0];
      expect(Array.isArray(insertedArgs)).toBe(true);
      expect(insertedArgs.length).toBe(3); // 3 defaults
      expect(res.length).toBe(1);
    });
  });

  describe('incrementProgress', () => {
    it('should handle missing data gracefully', async () => {
      mockQueryBuilder.then.mockImplementationOnce((res, rej) => {
        return Promise.resolve({ data: null }).then(res, rej);
      });
      await service.incrementProgress('user1', 'key1', 1);
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
    });

    it('should run updates concurrently with Promise.allSettled', async () => {
      const mockData = [
        { id: '1', progress: 0, target: 5, reward_coins: 10 },
        { id: '2', progress: 4, target: 5, reward_coins: 20 },
      ];
      mockQueryBuilder.then.mockImplementationOnce((res, rej) => {
        return Promise.resolve({ data: mockData }).then(res, rej);
      });
      mockQueryBuilder.then.mockImplementation((res, rej) => {
        return Promise.resolve({ data: null }).then(res, rej);
      }); // For the updates

      await service.incrementProgress('user1', 'key1', 1);

      expect(mockQueryBuilder.update).toHaveBeenCalledTimes(2);
      expect(usersService.awardCoins).toHaveBeenCalledTimes(1);
      expect(usersService.awardCoins).toHaveBeenCalledWith('user1', 20);
    });
  });
});
