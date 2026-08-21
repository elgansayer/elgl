import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StudyStreakService } from './study-streak.service';
import { SupabaseService } from '../supabase/supabase.service';

type MockRow = {
  study_streak_days?: number;
  last_active_at?: string;
};

type MockResult = {
  data: MockRow | null;
  error: { code?: string; message: string } | null;
};

type QueryChainMock = {
  select: Mock;
  from: Mock;
  eq: Mock;
  single: Mock;
  update: Mock;
  upsert: Mock;
  _setResolveData: (data: MockResult) => void;
  then: (resolve: (value: MockResult) => void) => undefined;
};

// Helper to create a mock query chain that mimics the Supabase PostgREST
// fluent API so the service doesn't throw when it calls methods like `.eq`.
const createQueryChain = (): QueryChainMock => {
  const chain = {} as QueryChainMock;
  const methods = [
    'select',
    'from',
    'eq',
    'single',
    'update',
    'upsert',
  ] as const;
  methods.forEach((method) => {
    chain[method] = vi.fn().mockReturnValue(chain);
  });

  let resolveData: MockResult | null = null;

  chain._setResolveData = (data: MockResult) => {
    resolveData = data;
  };

  chain.then = (resolve: (value: MockResult) => void) => {
    resolve(resolveData ?? { data: null, error: null });
    return undefined;
  };

  return chain;
};

describe('StudyStreakService', () => {
  let service: StudyStreakService;
  let supabaseMock: { from: Mock };
  let eventEmitterMock: { emit: Mock };

  beforeEach(async () => {
    supabaseMock = {
      from: vi.fn(() => createQueryChain()),
    };
    eventEmitterMock = {
      emit: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudyStreakService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(supabaseMock),
          },
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitterMock,
        },
      ],
    }).compile();

    service = module.get<StudyStreakService>(StudyStreakService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStreak', () => {
    it('returns the stored streak value', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({
          data: { study_streak_days: 5 },
          error: null,
        });
        return chain;
      });

      await expect(service.getStreak('user-1')).resolves.toBe(5);
    });

    it('returns 0 when the user row is missing', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({
          data: null,
          error: { code: 'PGRST116', message: 'not found' },
        });
        return chain;
      });

      await expect(service.getStreak('user-1')).resolves.toBe(0);
    });

    it('throws for unexpected errors', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({
          data: null,
          error: { code: 'OTHER', message: 'boom' },
        });
        return chain;
      });

      await expect(service.getStreak('user-1')).rejects.toThrow(
        'Failed to fetch streak: boom',
      );
    });
  });

  describe('updateStreak', () => {
    it('creates an initial streak of 1 when the user row is missing', async () => {
      const selectChain = createQueryChain();
      selectChain._setResolveData({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });
      const upsertChain = createQueryChain();
      upsertChain._setResolveData({ data: null, error: null });

      supabaseMock.from
        .mockImplementationOnce(() => selectChain)
        .mockImplementationOnce(() => upsertChain);

      await expect(service.updateStreak('user-1')).resolves.toBe(1);
      expect(upsertChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1', study_streak_days: 1 }),
        { onConflict: 'id' },
      );
      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'achievements.evaluate',
        { userId: 'user-1' },
      );
    });

    it('keeps the streak unchanged when already checked in today', async () => {
      const selectChain = createQueryChain();
      selectChain._setResolveData({
        data: {
          study_streak_days: 4,
          last_active_at: new Date().toISOString(),
        },
        error: null,
      });
      const updateChain = createQueryChain();
      updateChain._setResolveData({ data: null, error: null });

      supabaseMock.from
        .mockImplementationOnce(() => selectChain)
        .mockImplementationOnce(() => updateChain);

      await expect(service.updateStreak('user-1')).resolves.toBe(4);
      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'achievements.evaluate',
        { userId: 'user-1' },
      );
    });

    it('increments the streak when the last check-in was yesterday', async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      const selectChain = createQueryChain();
      selectChain._setResolveData({
        data: { study_streak_days: 4, last_active_at: yesterday },
        error: null,
      });
      const updateChain = createQueryChain();
      updateChain._setResolveData({ data: null, error: null });

      supabaseMock.from
        .mockImplementationOnce(() => selectChain)
        .mockImplementationOnce(() => updateChain);

      await expect(service.updateStreak('user-1')).resolves.toBe(5);
      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'achievements.evaluate',
        { userId: 'user-1' },
      );
    });

    it('resets the streak to 1 after a gap of more than one day', async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
      const selectChain = createQueryChain();
      selectChain._setResolveData({
        data: { study_streak_days: 9, last_active_at: threeDaysAgo },
        error: null,
      });
      const updateChain = createQueryChain();
      updateChain._setResolveData({ data: null, error: null });

      supabaseMock.from
        .mockImplementationOnce(() => selectChain)
        .mockImplementationOnce(() => updateChain);

      await expect(service.updateStreak('user-1')).resolves.toBe(1);
      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'achievements.evaluate',
        { userId: 'user-1' },
      );
    });

    it('throws when the update fails', async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      const selectChain = createQueryChain();
      selectChain._setResolveData({
        data: { study_streak_days: 4, last_active_at: yesterday },
        error: null,
      });
      const updateChain = createQueryChain();
      updateChain._setResolveData({
        data: null,
        error: { message: 'db unavailable' },
      });

      supabaseMock.from
        .mockImplementationOnce(() => selectChain)
        .mockImplementationOnce(() => updateChain);

      await expect(service.updateStreak('user-1')).rejects.toThrow(
        'Failed to update streak: db unavailable',
      );
    });
  });
});
