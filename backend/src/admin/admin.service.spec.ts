import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { SupabaseService } from '../supabase/supabase.service';
import { DataScrubbingService } from '../privacy/data-scrubbing.service';
import { MetricsService } from '../metrics/metrics.service';

const mockPinoLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

describe('AdminService', () => {
  let service: AdminService;
  let mockSupabaseClient: Record<string, Mock>;
  let mockQueryBuilder: Record<string, Mock>;
  let mockRedisClient: Record<string, Mock>;

  beforeEach(async () => {
    mockRedisClient = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      keys: vi.fn().mockResolvedValue([]),
    };

    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      limit: vi.fn(),
      single: vi.fn(),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    const mockScrubbingService = {
      scrubIpAddress: vi.fn((raw: string | null | undefined) => {
        if (!raw) return null;
        // Simple mock: zero last octet for IPv4-like strings
        const parts = raw.trim().split('.');
        if (parts.length === 4) {
          return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
        }
        return raw.trim();
      }),
      scrubLoginHistory: vi.fn(
        (entries: Array<{ ip_address?: string | null }>) => {
          for (const entry of entries) {
            if (entry.ip_address) {
              const parts = entry.ip_address.trim().split('.');
              if (parts.length === 4) {
                entry.ip_address = `${parts[0]}.${parts[1]}.${parts[2]}.0`;
              }
            }
          }
        },
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: 'PinoLogger:AdminService',
          useValue: mockPinoLogger,
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
            getRedisClient: vi.fn().mockReturnValue(mockRedisClient),
          },
        },
        {
          provide: DataScrubbingService,
          useValue: mockScrubbingService,
        },
        {
          provide: `PinoLogger:${AdminService.name}`,
          useValue: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            trace: vi.fn(),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            recordAdminBanAction: vi.fn(),
            recordAdminWarnAction: vi.fn(),
            recordAdminVipToggle: vi.fn(),
            recordAdminBlockRemoval: vi.fn(),
            recordAdminReportResolution: vi.fn(),
            recordAdminApiError: vi.fn(),
            observeAdminApiLatency: vi.fn(),
            setAdminPendingReports: vi.fn(),
            setAdminActiveBlocks: vi.fn(),
            recordAdminLoginHistoryRequest: vi.fn(),
            recordTsReportSubmitted: vi.fn(),
            setTsPendingReports: vi.fn(),
            setTsActiveBlocksTotal: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listUsers', () => {
    it('returns cached users when cache hit occurs', async () => {
      const cached = {
        users: [{ id: 'cached-1', display_name: 'Cachette' }],
        total: 1,
        page: 1,
        pageSize: 20,
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.listUsers({ page: 1, pageSize: 20 });

      expect(result).toEqual(cached);
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('returns paginated users and caches them on cache miss', async () => {
      const users = [{ id: 'user-1', display_name: 'Ada' }];
      mockQueryBuilder.range.mockResolvedValue({
        data: users,
        error: null,
        count: 1,
      });

      const result = await service.listUsers({ page: 1, pageSize: 20 });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(result).toEqual({
        users,
        total: 1,
        page: 1,
        pageSize: 20,
      });
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'admin:users:list:1:20:',
        JSON.stringify({ users, total: 1, page: 1, pageSize: 20 }),
        'EX',
        300,
      );
    });

    it('still returns results when Redis cache write fails', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockRejectedValue(new Error('Redis down'));
      mockQueryBuilder.range.mockResolvedValue({
        data: [{ id: 'user-1' }],
        error: null,
        count: 1,
      });

      const result = await service.listUsers({ page: 1, pageSize: 20 });

      expect(result.total).toBe(1);
    });

    it('falls through to Supabase when cached JSON is malformed', async () => {
      mockRedisClient.get.mockResolvedValue('not-json');
      mockQueryBuilder.range.mockResolvedValue({
        data: [{ id: 'user-1' }],
        error: null,
        count: 1,
      });

      const result = await service.listUsers({ page: 1, pageSize: 20 });

      expect(result.users).toHaveLength(1);
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
    it('updates is_vip and vip_tier, invalidates user list and login history caches', async () => {
      const updated = { id: 'user-1', is_vip: true, vip_tier: 'consumer' };
      mockQueryBuilder.single.mockResolvedValue({ data: updated, error: null });
      mockRedisClient.keys.mockResolvedValue([
        'admin:users:list:1:20:',
        'admin:users:list:2:10:search',
      ]);

      const result = await service.setVipStatus('user-1', {
        is_vip: true,
        vip_tier: 'consumer',
      });

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        is_vip: true,
        vip_tier: 'consumer',
      });
      expect(result).toEqual(updated);
      expect(mockRedisClient.keys).toHaveBeenCalledWith('admin:users:list:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'admin:users:list:1:20:',
        'admin:users:list:2:10:search',
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'admin:login-history:user-1',
      );
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
    it('returns cached login history on cache hit', async () => {
      const cached = [
        {
          id: 'cached-log',
          user_id: 'user-1',
          created_at: '2026-01-01T00:00:00Z',
        },
      ];
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getLoginHistory('user-1');

      expect(result).toEqual(cached);
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('returns login history and caches it on cache miss', async () => {
      const history = [
        { id: 'log-1', user_id: 'user-1', created_at: '2026-01-01T00:00:00Z' },
      ];
      mockQueryBuilder.limit.mockResolvedValue({ data: history, error: null });

      const result = await service.getLoginHistory('user-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('login_history');
      expect(result).toEqual(history);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'admin:login-history:user-1',
        JSON.stringify(history),
        'EX',
        600,
      );
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

  describe('banUser', () => {
    it('inserts a block and invalidates user list, blocks list, and login history caches', async () => {
      mockQueryBuilder.insert.mockImplementation(() => mockQueryBuilder);
      mockQueryBuilder.select = vi.fn().mockResolvedValue({ error: null });
      mockRedisClient.keys
        .mockResolvedValueOnce(['admin:users:list:1:20:'])
        .mockResolvedValueOnce(['admin:blocks:list:1:20:']);

      await service.banUser('bad-user', 'admin-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blocks');
      expect(mockRedisClient.keys).toHaveBeenCalledWith('admin:users:list:*');
      expect(mockRedisClient.keys).toHaveBeenCalledWith('admin:blocks:list:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'admin:login-history:bad-user',
      );
    });

    it('throws NotFoundException when the insert fails', async () => {
      mockQueryBuilder.insert.mockResolvedValue({ error: { message: 'dup' } });

      await expect(service.banUser('bad-user', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('warnUser', () => {
    it('inserts a report and invalidates user list, reports list, and login history caches', async () => {
      mockQueryBuilder.insert.mockImplementation(() => mockQueryBuilder);
      mockQueryBuilder.select = vi.fn().mockResolvedValue({ error: null });
      mockRedisClient.keys
        .mockResolvedValueOnce(['admin:users:list:1:20:'])
        .mockResolvedValueOnce(['admin:reports:list:1:20:']);

      await service.warnUser('bad-user', 'admin-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('reports');
      expect(mockRedisClient.keys).toHaveBeenCalledWith('admin:users:list:*');
      expect(mockRedisClient.keys).toHaveBeenCalledWith('admin:reports:list:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'admin:login-history:bad-user',
      );
    });

    it('throws NotFoundException when the insert fails', async () => {
      mockQueryBuilder.insert.mockResolvedValue({ error: { message: 'err' } });

      await expect(service.warnUser('bad-user', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listAllBlocks', () => {
    it('returns cached blocks on cache hit', async () => {
      const cached = {
        blocks: [
          {
            id: 'cached-block',
            blocker_id: 'u1',
            blocked_id: 'u2',
            blocker_name: null,
            blocked_name: null,
            blocker_avatar: null,
            blocked_avatar: null,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.listAllBlocks(1, 20);

      expect(result).toEqual(cached);
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('returns paginated blocks and caches them on cache miss', async () => {
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
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'admin:blocks:list:1:20',
        expect.any(String),
        'EX',
        300,
      );
      expect(result.blocks[0].blocker_name).toBe('Ada');
      expect(result.blocks[0].blocked_name).toBe('Bob');
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
      mockQueryBuilder.insert = vi.fn().mockReturnValue({ error: null });

      await service.banUser('target-user', 'admin-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blocks');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        blocker_id: 'admin-1',
        blocked_id: 'target-user',
      });
    });

    it('throws NotFoundException when the insert errors', async () => {
      mockQueryBuilder.insert = vi.fn().mockReturnValue({
        error: { message: 'db error' },
      });

      await expect(service.banUser('target-user', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('warnUser', () => {
    it('inserts a report row as an admin warning and succeeds', async () => {
      mockQueryBuilder.insert = vi.fn().mockReturnValue({ error: null });

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
      mockQueryBuilder.insert = vi.fn().mockReturnValue({
        error: { message: 'db error' },
      });

      await expect(service.warnUser('target-user', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listReports', () => {
    it('returns cached reports on cache hit', async () => {
      const cached = {
        reports: [
          {
            id: 'cached-report',
            reporter_id: 'u1',
            reported_user_id: 'u2',
            reason_category: 'spam',
            description: null,
            status: 'pending',
            reported_name: null,
            reporter_name: null,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.listReports(1, 20);

      expect(result).toEqual(cached);
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('returns paginated reports and caches them on cache miss', async () => {
      const reportRows = [
        {
          id: 'report-1',
          reporter_id: 'user-1',
          reported_user_id: 'user-2',
          reason_category: 'spam',
          description: 'Spam messages',
          status: 'pending',
          created_at: '2026-01-01T00:00:00Z',
          reported: { display_name: 'Bob' },
          reporter: { display_name: 'Alice' },
        },
      ];
      mockQueryBuilder.range.mockResolvedValue({
        data: reportRows,
        error: null,
        count: 1,
      });

      const result = await service.listReports(1, 20);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('reports');
      expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 19);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'admin:reports:list:1:20:',
        expect.any(String),
        'EX',
        300,
      );
      expect(result.reports[0].reported_name).toBe('Bob');
      expect(result.reports[0].reporter_name).toBe('Alice');
    });

    it('filters by report status when statusFilter is provided', async () => {
      mockQueryBuilder.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      await service.listReports(1, 20, 'pending');

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('status', 'pending');
    });

    it('returns an empty result when the query errors', async () => {
      mockQueryBuilder.range.mockResolvedValue({
        data: null,
        error: { message: 'boom' },
        count: null,
      });

      const result = await service.listReports(1, 20);

      expect(result).toEqual({ reports: [], total: 0, page: 1, pageSize: 20 });
    });
  });

  describe('removeBlock', () => {
    it('deletes the block, returns success, and invalidates blocks list cache', async () => {
      mockQueryBuilder.delete = vi
        .fn()
        .mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      mockRedisClient.keys.mockResolvedValue(['admin:blocks:list:1:20']);

      const result = await service.removeBlock('block-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blocks');
      expect(result).toEqual({ success: true });
      expect(mockRedisClient.keys).toHaveBeenCalledWith('admin:blocks:list:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'admin:blocks:list:1:20',
      );
    });

    it('throws NotFoundException when delete fails', async () => {
      mockQueryBuilder.delete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'not found' } }),
      });

      await expect(service.removeBlock('missing-block')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
