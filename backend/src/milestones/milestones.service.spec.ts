import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MilestonesService } from './milestones.service';
import { SupabaseService } from '../supabase/supabase.service';

type MilestoneRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
};

type MockResult = {
  data: MilestoneRow | MilestoneRow[] | null;
  error: { message: string } | null;
};

type QueryChainMock = {
  select: Mock;
  from: Mock;
  eq: Mock;
  order: Mock;
  insert: Mock;
  update: Mock;
  delete: Mock;
  single: Mock;
  maybeSingle: Mock;
  _setResolveData: (data: MockResult) => void;
  then: (resolve: (value: MockResult) => void) => undefined;
};

const createQueryChain = (): QueryChainMock => {
  const chain = {} as QueryChainMock;
  const methods = [
    'select',
    'from',
    'eq',
    'order',
    'insert',
    'update',
    'delete',
    'single',
    'maybeSingle',
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

const sampleRow: MilestoneRow = {
  id: 'milestone-1',
  user_id: 'user-1',
  title: 'Complete 10 flashcards',
  description: null,
  completed: false,
  completed_at: null,
  created_at: '2026-08-01T00:00:00.000Z',
};

describe('MilestonesService', () => {
  let service: MilestonesService;
  let supabaseMock: { from: Mock };

  beforeEach(async () => {
    supabaseMock = { from: vi.fn(() => createQueryChain()) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MilestonesService,
        {
          provide: SupabaseService,
          useValue: { getClient: vi.fn().mockReturnValue(supabaseMock) },
        },
      ],
    }).compile();

    service = module.get<MilestonesService>(MilestonesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('inserts and returns the created milestone', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({ data: sampleRow, error: null });
        return chain;
      });

      const result = await service.create(
        { title: 'Complete 10 flashcards' },
        'user-1',
      );

      expect(result).toEqual({
        id: 'milestone-1',
        userId: 'user-1',
        title: 'Complete 10 flashcards',
        description: null,
        completed: false,
        completedAt: null,
        createdAt: '2026-08-01T00:00:00.000Z',
      });
    });

    it('throws when the insert fails', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({ data: null, error: { message: 'boom' } });
        return chain;
      });

      await expect(
        service.create({ title: 'Fails' }, 'user-1'),
      ).rejects.toThrow('Failed to create milestone: Validation failed');
    });
  });

  describe('findAllForUser', () => {
    it('returns milestones for the user', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({ data: [sampleRow], error: null });
        return chain;
      });

      const result = await service.findAllForUser('user-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('milestone-1');
    });

    it('returns an empty array when there is no data', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({ data: null, error: null });
        return chain;
      });

      await expect(service.findAllForUser('user-1')).resolves.toEqual([]);
    });
  });

  describe('findOneForUser', () => {
    it('returns the milestone when found', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({ data: sampleRow, error: null });
        return chain;
      });

      await expect(
        service.findOneForUser('user-1', 'milestone-1'),
      ).resolves.toMatchObject({ id: 'milestone-1' });
    });

    it('throws NotFoundException when missing', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({ data: null, error: null });
        return chain;
      });

      await expect(
        service.findOneForUser('user-1', 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('markCompleted', () => {
    it('marks the milestone as completed', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({
          data: {
            ...sampleRow,
            completed: true,
            completed_at: '2026-08-01T01:00:00.000Z',
          },
          error: null,
        });
        return chain;
      });

      const result = await service.markCompleted('milestone-1', 'user-1');
      expect(result.completed).toBe(true);
      expect(result.completedAt).toBe('2026-08-01T01:00:00.000Z');
    });

    it('throws NotFoundException when the milestone does not belong to the user', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({ data: null, error: null });
        return chain;
      });

      await expect(
        service.markCompleted('milestone-1', 'someone-else'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the milestone', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({ data: sampleRow, error: null });
        return chain;
      });

      await expect(
        service.remove('milestone-1', 'user-1'),
      ).resolves.toBeUndefined();
    });

    it('throws NotFoundException when nothing was deleted', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({ data: null, error: null });
        return chain;
      });

      await expect(
        service.remove('milestone-1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getProgress', () => {
    it('computes completion percentage', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({
          data: [
            sampleRow,
            { ...sampleRow, id: 'milestone-2', completed: true },
          ],
          error: null,
        });
        return chain;
      });

      await expect(service.getProgress('user-1')).resolves.toEqual({
        total: 2,
        completed: 1,
        percentage: 50,
      });
    });

    it('returns zero percentage when there are no milestones', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({ data: [], error: null });
        return chain;
      });

      await expect(service.getProgress('user-1')).resolves.toEqual({
        total: 0,
        completed: 0,
        percentage: 0,
      });
    });
  });
});
