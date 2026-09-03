import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProfileVisitsService } from './profile-visits.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('ProfileVisitsService', () => {
  let service: ProfileVisitsService;
  let mockSupabaseClient: { from: Mock };
  let query: {
    insert: Mock;
    delete: Mock;
    select: Mock;
    eq: Mock;
    gte: Mock;
    order: Mock;
    range: Mock;
    limit: Mock;
    single: Mock;
  };
  let eventEmitter: { emit: Mock };

  beforeEach(async () => {
    query = {
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      single: vi.fn(),
    };
    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(query),
    };
    eventEmitter = { emit: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileVisitsService,
        {
          provide: SupabaseService,
          useValue: { getClient: vi.fn().mockReturnValue(mockSupabaseClient) },
        },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get(ProfileVisitsService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('recordVisit', () => {
    it('never records a self view', async () => {
      await expect(service.recordVisit('user-1', 'user-1')).resolves.toEqual({
        recorded: false,
        ignored: true,
        reason: 'self',
      });
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('never records an incognito VIP visit', async () => {
      query.single.mockResolvedValueOnce({
        data: {
          is_vip: true,
          incognito_visits: true,
          is_deleted: false,
          scheduled_for_deletion_at: null,
        },
        error: null,
      });

      await expect(
        service.recordVisit('viewer-1', 'target-1'),
      ).resolves.toEqual({
        recorded: false,
        ignored: true,
        reason: 'incognito',
      });
      expect(query.insert).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('never records a hidden, deleted or deletion-pending profile', async () => {
      query.single
        .mockResolvedValueOnce({
          data: { is_vip: false, incognito_visits: false },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'target-1',
            is_vip: true,
            is_deleted: false,
            scheduled_for_deletion_at: null,
            profile_visibility: 'hidden',
          },
          error: null,
        });

      await expect(
        service.recordVisit('viewer-1', 'target-1'),
      ).resolves.toEqual({
        recorded: false,
        ignored: true,
        reason: 'unavailable',
      });
      expect(query.insert).not.toHaveBeenCalled();
    });

    it('never lets a non-VIP caller forge a visit to a VIP-only profile', async () => {
      query.single
        .mockResolvedValueOnce({
          data: { is_vip: false, incognito_visits: false },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'target-1',
            is_deleted: false,
            scheduled_for_deletion_at: null,
            profile_visibility: 'vips_only',
          },
          error: null,
        });

      await expect(
        service.recordVisit('viewer-1', 'target-1'),
      ).resolves.toEqual({
        recorded: false,
        ignored: true,
        reason: 'unavailable',
      });
      expect(query.insert).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('never records a visit when either user has blocked the other', async () => {
      query.single
        .mockResolvedValueOnce({
          data: { is_vip: false, incognito_visits: false },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'target-1',
            is_deleted: false,
            scheduled_for_deletion_at: null,
            profile_visibility: 'everyone',
          },
          error: null,
        });
      query.limit.mockResolvedValueOnce({
        data: [{ id: 'block-1' }],
        error: null,
      });

      await expect(
        service.recordVisit('viewer-1', 'target-1'),
      ).resolves.toEqual({
        recorded: false,
        ignored: true,
        reason: 'blocked',
      });
      expect(query.insert).not.toHaveBeenCalled();
    });

    it('coalesces duplicate refreshes using the database unique key and emits no duplicate notification', async () => {
      query.single
        .mockResolvedValueOnce({
          data: { is_vip: false, incognito_visits: false },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'target-1',
            is_deleted: false,
            scheduled_for_deletion_at: null,
            profile_visibility: 'everyone',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: { code: '23505', message: 'duplicate key' },
        });
      query.limit
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      await expect(
        service.recordVisit('viewer-1', 'target-1'),
      ).resolves.toEqual({
        recorded: false,
        ignored: true,
        reason: 'duplicate',
      });
      expect(query.insert).toHaveBeenCalledWith({
        visitor_id: 'viewer-1',
        viewed_id: 'target-1',
      });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('records an eligible visit once and emits the notification event', async () => {
      query.single
        .mockResolvedValueOnce({
          data: { is_vip: false, incognito_visits: false },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'target-1',
            is_vip: true,
            is_deleted: false,
            scheduled_for_deletion_at: null,
            profile_visibility: 'everyone',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'visit-1', created_at: '2026-08-20T12:00:00.000Z' },
          error: null,
        });
      query.limit
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      await expect(
        service.recordVisit('viewer-1', 'target-1'),
      ).resolves.toEqual({
        recorded: true,
        ignored: false,
        visit_id: 'visit-1',
      });
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'profile.visit',
        expect.objectContaining({
          viewerId: 'viewer-1',
          viewedUserId: 'target-1',
          identityVisible: true,
        }),
      );
    });

    it('fails closed if privacy or block state cannot be verified', async () => {
      query.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'database unavailable' },
      });

      await expect(service.recordVisit('viewer-1', 'target-1')).rejects.toThrow(
        'Failed to verify profile-visit privacy',
      );
      expect(query.insert).not.toHaveBeenCalled();
    });
  });

  describe('getVisitors', () => {
    const visitor = {
      id: 'visitor-1',
      display_name: 'Visible Visitor',
      avatar_url: 'avatar.png',
      native_languages: ['en'],
      target_languages: ['ja'],
      bio_text: 'Hello',
      is_vip: false,
      is_deleted: false,
      scheduled_for_deletion_at: null,
      profile_visibility: 'everyone',
    };

    it('never returns visitor identity to a non-VIP API caller', async () => {
      query.single.mockResolvedValueOnce({
        data: {
          is_vip: false,
          is_deleted: false,
          scheduled_for_deletion_at: null,
        },
        error: null,
      });
      query.range.mockResolvedValueOnce({
        data: [
          {
            id: 'visit-1',
            created_at: '2026-08-20T12:00:00.000Z',
            visitor,
          },
        ],
        error: null,
      });

      const page = await service.getVisitors('owner-1', 20, 0);

      expect(page.identity_visible).toBe(false);
      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toMatchObject({
        is_blurred: true,
        visitor: {
          id: 'hidden-vip-only',
          avatar_url: null,
          native_languages: [],
          target_languages: [],
        },
      });
      expect(JSON.stringify(page.items[0])).not.toContain('Visible Visitor');
      expect(JSON.stringify(page.items[0])).not.toContain('visitor-1');
    });

    it('returns full visitor identity to a verified VIP owner', async () => {
      query.single.mockResolvedValueOnce({
        data: {
          is_vip: true,
          is_deleted: false,
          scheduled_for_deletion_at: null,
        },
        error: null,
      });
      query.range.mockResolvedValueOnce({
        data: [
          {
            id: 'visit-1',
            created_at: '2026-08-20T12:00:00.000Z',
            visitor,
          },
        ],
        error: null,
      });

      const page = await service.getVisitors('owner-1', 20, 0);

      expect(page.identity_visible).toBe(true);
      expect(page.items[0].is_blurred).toBe(false);
      expect(page.items[0].visitor.id).toBe('visitor-1');
      expect(page.items[0].visitor.display_name).toBe('Visible Visitor');
    });

    it('filters historical rows for visitors who are now hidden or deletion-pending', async () => {
      query.single.mockResolvedValueOnce({
        data: {
          is_vip: true,
          is_deleted: false,
          scheduled_for_deletion_at: null,
        },
        error: null,
      });
      query.range.mockResolvedValueOnce({
        data: [
          {
            id: 'visit-hidden',
            created_at: '2026-08-20T12:00:00.000Z',
            visitor: { ...visitor, profile_visibility: 'hidden' },
          },
          {
            id: 'visit-pending',
            created_at: '2026-08-20T11:00:00.000Z',
            visitor: {
              ...visitor,
              id: 'visitor-2',
              scheduled_for_deletion_at: '2026-08-21T00:00:00.000Z',
            },
          },
        ],
        error: null,
      });

      const page = await service.getVisitors('owner-1', 20, 0);
      expect(page.items).toEqual([]);
    });

    it('bounds pagination and exposes an explicit next offset', async () => {
      query.single.mockResolvedValueOnce({
        data: {
          is_vip: true,
          is_deleted: false,
          scheduled_for_deletion_at: null,
        },
        error: null,
      });
      query.range.mockResolvedValueOnce({
        data: Array.from({ length: 51 }, (_, index) => ({
          id: `visit-${index}`,
          created_at: '2026-08-20T12:00:00.000Z',
          visitor: { ...visitor, id: `visitor-${index}` },
        })),
        error: null,
      });

      const page = await service.getVisitors('owner-1', 500, -10);

      expect(query.range).toHaveBeenCalledWith(0, 50);
      expect(page.limit).toBe(50);
      expect(page.offset).toBe(0);
      expect(page.items).toHaveLength(50);
      expect(page.has_more).toBe(true);
      expect(page.next_offset).toBe(50);
    });

    it('surfaces storage failures instead of turning them into an empty state', async () => {
      query.single.mockResolvedValueOnce({
        data: {
          is_vip: true,
          is_deleted: false,
          scheduled_for_deletion_at: null,
        },
        error: null,
      });
      query.range.mockResolvedValueOnce({
        data: null,
        error: { message: 'query failed' },
      });

      await expect(service.getVisitors('owner-1')).rejects.toThrow(
        'Failed to fetch profile visitors',
      );
    });

    it('fails closed if the owner entitlement cannot be verified', async () => {
      query.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'query failed' },
      });

      await expect(service.getVisitors('owner-1')).rejects.toThrow(
        'Failed to verify visitor-log entitlement',
      );
      expect(query.range).not.toHaveBeenCalled();
    });
  });
});
