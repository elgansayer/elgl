import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StudyBuddiesService } from './study-buddies.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';

type BuddyRequestRow = {
  id: string;
  requester_id: string;
  partner_id: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
};

type MockResult = {
  data: unknown;
  error: { message: string } | null;
};

type QueryChainMock = {
  select: Mock;
  from: Mock;
  eq: Mock;
  neq: Mock;
  overlaps: Mock;
  order: Mock;
  limit: Mock;
  returns: Mock;
  upsert: Mock;
  update: Mock;
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
    'neq',
    'overlaps',
    'order',
    'limit',
    'returns',
    'upsert',
    'update',
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

const sampleRequestRow: BuddyRequestRow = {
  id: 'req-1',
  requester_id: 'user-1',
  partner_id: 'user-2',
  message: 'Fancy practising together?',
  status: 'pending',
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
};

describe('StudyBuddiesService', () => {
  let service: StudyBuddiesService;
  let supabaseMock: { from: Mock };
  let usersServiceMock: { followUser: Mock; unfollowUser: Mock };

  beforeEach(async () => {
    supabaseMock = { from: vi.fn(() => createQueryChain()) };
    usersServiceMock = {
      followUser: vi.fn().mockResolvedValue(undefined),
      unfollowUser: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudyBuddiesService,
        {
          provide: SupabaseService,
          useValue: { getClient: vi.fn().mockReturnValue(supabaseMock) },
        },
        { provide: UsersService, useValue: usersServiceMock },
      ],
    }).compile();

    service = module.get<StudyBuddiesService>(StudyBuddiesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestBuddy', () => {
    it('upserts and returns the buddy request', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({ data: sampleRequestRow, error: null });
        return chain;
      });

      const result = await service.requestBuddy(
        { partnerId: 'user-2', message: 'Fancy practising together?' },
        'user-1',
      );

      expect(result).toEqual({
        id: 'req-1',
        requesterId: 'user-1',
        partnerId: 'user-2',
        message: 'Fancy practising together?',
        status: 'pending',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      });
    });

    it('rejects requests targeting yourself', async () => {
      await expect(
        service.requestBuddy({ partnerId: 'user-1' }, 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when the upsert fails', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({ data: null, error: { message: 'boom' } });
        return chain;
      });

      await expect(
        service.requestBuddy({ partnerId: 'user-2' }, 'user-1'),
      ).rejects.toThrow('Failed to create study buddy request: boom');
    });
  });

  describe('getIncomingRequests', () => {
    it('returns pending requests for the partner', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({ data: [sampleRequestRow], error: null });
        return chain;
      });

      const result = await service.getIncomingRequests('user-2');
      expect(result).toHaveLength(1);
      expect(result[0].partnerId).toBe('user-2');
    });
  });

  describe('respondToRequest', () => {
    it('accepts a request addressed to the responder', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({
          data: { ...sampleRequestRow, status: 'accepted' },
          error: null,
        });
        return chain;
      });

      const result = await service.respondToRequest(
        'req-1',
        'user-2',
        'accepted',
      );
      expect(result.status).toBe('accepted');
    });

    it('throws NotFoundException when the request does not belong to the responder', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({ data: null, error: null });
        return chain;
      });

      await expect(
        service.respondToRequest('req-1', 'someone-else', 'declined'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getPotentialBuddies', () => {
    it('returns an empty array when the user cannot be found', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({ data: null, error: null });
        return chain;
      });

      await expect(service.getPotentialBuddies('user-1')).resolves.toEqual([]);
    });

    it('returns matching users', async () => {
      let callCount = 0;
      supabaseMock.from.mockImplementation(() => {
        callCount += 1;
        const chain = createQueryChain();
        if (callCount === 1) {
          chain._setResolveData({
            data: { target_languages: ['fr'], native_languages: ['en'] },
            error: null,
          });
        } else {
          chain._setResolveData({
            data: [{ id: 'user-2', display_name: 'Bob' }],
            error: null,
          });
        }
        return chain;
      });

      await expect(service.getPotentialBuddies('user-1')).resolves.toEqual([
        { id: 'user-2', display_name: 'Bob' },
      ]);
    });
  });

  describe('followUser / unfollowUser', () => {
    it('delegates following to UsersService', async () => {
      await service.followUser('user-1', 'user-2');
      expect(usersServiceMock.followUser).toHaveBeenCalledWith(
        'user-1',
        'user-2',
      );
    });

    it('delegates unfollowing to UsersService', async () => {
      await service.unfollowUser('user-1', 'user-2');
      expect(usersServiceMock.unfollowUser).toHaveBeenCalledWith(
        'user-1',
        'user-2',
      );
    });
  });

  describe('getOrCreateChannel', () => {
    it('returns a deterministic channel name regardless of argument order', () => {
      expect(service.getOrCreateChannel('user-1', 'user-2')).toEqual(
        service.getOrCreateChannel('user-2', 'user-1'),
      );
    });
  });
});
