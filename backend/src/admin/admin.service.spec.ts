import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('AdminService', () => {
  let service: AdminService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn(),
      eq: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      limit: jest.fn(),
      single: jest.fn(),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listUsers', () => {
    it('returns paginated users without a search term', async () => {
      const users = [{ id: 'user-1', display_name: 'Ada' }];
      mockQueryBuilder.range.mockResolvedValue({
        data: users,
        error: null,
        count: 1,
      });

      const result = await service.listUsers({ page: 1, pageSize: 20 });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockQueryBuilder.ilike).not.toHaveBeenCalled();
      expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 19);
      expect(result).toEqual({
        users,
        total: 1,
        page: 1,
        pageSize: 20,
      });
    });

    it('filters by search term using ilike on display_name', async () => {
      mockQueryBuilder.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      await service.listUsers({ search: 'ada', page: 2, pageSize: 10 });

      expect(mockQueryBuilder.ilike).toHaveBeenCalledWith(
        'display_name',
        '%ada%',
      );
      expect(mockQueryBuilder.range).toHaveBeenCalledWith(10, 19);
    });

    it('returns an empty result when the query errors', async () => {
      mockQueryBuilder.range.mockResolvedValue({
        data: null,
        error: { message: 'boom' },
        count: null,
      });

      const result = await service.listUsers({ page: 1, pageSize: 20 });

      expect(result).toEqual({ users: [], total: 0, page: 1, pageSize: 20 });
    });
  });

  describe('setVipStatus', () => {
    it('updates is_vip and vip_tier and returns the updated user', async () => {
      const updated = { id: 'user-1', is_vip: true, vip_tier: 'consumer' };
      mockQueryBuilder.single.mockResolvedValue({ data: updated, error: null });

      const result = await service.setVipStatus('user-1', {
        is_vip: true,
        vip_tier: 'consumer',
      });

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        is_vip: true,
        vip_tier: 'consumer',
      });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'user-1');
      expect(result).toEqual(updated);
    });

    it('defaults vip_tier to free when revoking VIP without a tier', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: 'user-1', is_vip: false, vip_tier: 'free' },
        error: null,
      });

      await service.setVipStatus('user-1', { is_vip: false });

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        is_vip: false,
        vip_tier: 'free',
      });
    });

    it('throws NotFoundException when the update fails', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      await expect(
        service.setVipStatus('missing-user', { is_vip: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getLoginHistory', () => {
    it('returns login history rows for a user', async () => {
      const history = [
        { id: 'log-1', user_id: 'user-1', created_at: '2026-01-01T00:00:00Z' },
      ];
      mockQueryBuilder.limit.mockResolvedValue({ data: history, error: null });

      const result = await service.getLoginHistory('user-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('login_history');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(result).toEqual(history);
    });

    it('returns an empty array when the query errors', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: null,
        error: { message: 'boom' },
      });

      const result = await service.getLoginHistory('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('listAllBlocks', () => {
    it('returns paginated blocks with blocker and blocked details', async () => {
      const blockRows = [
        {
          id: 'block-1',
          blocker_id: 'user-1',
          blocked_id: 'user-2',
          created_at: '2026-01-01T00:00:00Z',
          blocker: { display_name: 'Ada', avatar_url: null },
          blocked: {
            display_name: 'Bob',
            avatar_url: 'https://example.com/bob.png',
          },
        },
      ];
      mockQueryBuilder.range.mockResolvedValue({
        data: blockRows,
        error: null,
        count: 1,
      });

      const result = await service.listAllBlocks(1, 20);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blocks');
      expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 19);
      expect(result).toEqual({
        blocks: [
          {
            id: 'block-1',
            blocker_id: 'user-1',
            blocked_id: 'user-2',
            blocker_name: 'Ada',
            blocked_name: 'Bob',
            blocker_avatar: null,
            blocked_avatar: 'https://example.com/bob.png',
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      });
    });

    it('handles null blocker/blocked relations gracefully', async () => {
      const blockRows = [
        {
          id: 'block-1',
          blocker_id: 'user-1',
          blocked_id: 'user-2',
          created_at: '2026-01-01T00:00:00Z',
          blocker: null,
          blocked: null,
        },
      ];
      mockQueryBuilder.range.mockResolvedValue({
        data: blockRows,
        error: null,
        count: 1,
      });

      const result = await service.listAllBlocks(1, 20);

      expect(result.blocks[0].blocker_name).toBeNull();
      expect(result.blocks[0].blocked_name).toBeNull();
      expect(result.blocks[0].blocker_avatar).toBeNull();
    });

    it('returns an empty result when the query errors', async () => {
      mockQueryBuilder.range.mockResolvedValue({
        data: null,
        error: { message: 'boom' },
        count: null,
      });

      const result = await service.listAllBlocks(1, 20);

      expect(result).toEqual({ blocks: [], total: 0, page: 1, pageSize: 20 });
    });
  });

  describe('banUser', () => {
    it('inserts a block row for the admin and target and succeeds', async () => {
      mockQueryBuilder.insert = jest
        .fn()
        .mockReturnValue({ error: null });

      await service.banUser('target-user', 'admin-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blocks');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        blocker_id: 'admin-1',
        blocked_id: 'target-user',
      });
    });

    it('throws NotFoundException when the insert errors', async () => {
      mockQueryBuilder.insert = jest.fn().mockReturnValue({
        error: { message: 'db error' },
      });

      await expect(service.banUser('target-user', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('warnUser', () => {
    it('inserts a report row as an admin warning and succeeds', async () => {
      mockQueryBuilder.insert = jest
        .fn()
        .mockReturnValue({ error: null });

      await service.warnUser('target-user', 'admin-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('reports');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        reporter_id: 'admin-1',
        reported_user_id: 'target-user',
        reason_category: 'admin_warning',
        description: 'Admin warning',
        status: 'open',
      });
    });

    it('throws NotFoundException when the insert errors', async () => {
      mockQueryBuilder.insert = jest.fn().mockReturnValue({
        error: { message: 'db error' },
      });

      await expect(service.warnUser('target-user', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeBlock', () => {
    it('deletes the block and returns success', async () => {
      mockQueryBuilder.delete = jest
        .fn()
        .mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });

      const result = await service.removeBlock('block-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blocks');
      expect(result).toEqual({ success: true });
    });

    it('throws NotFoundException when delete fails', async () => {
      mockQueryBuilder.delete = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: { message: 'not found' } }),
      });

      await expect(service.removeBlock('missing-block')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
