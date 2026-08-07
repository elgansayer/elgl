import { Test, TestingModule } from '@nestjs/testing';
import { EscrowMetricsAggregator } from './escrow-metrics.aggregator';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from './metrics.service';

describe('EscrowMetricsAggregator', () => {
  let aggregator: EscrowMetricsAggregator;
  let mockSupabaseClient: Record<string, jest.Mock>;
  let mockRedisClient: Record<string, jest.Mock>;
  let mockMetricsService: {
    escrowTotalHeld: { set: jest.Mock };
    escrowTotalCoinsHeld: { set: jest.Mock };
    escrowStaleHeldCount: { set: jest.Mock };
    setEscrowDegradedQueueSize: jest.Mock;
  };

  beforeEach(async () => {
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
    };

    mockRedisClient = {
      llen: jest.fn().mockResolvedValue(0),
    };

    mockMetricsService = {
      escrowTotalHeld: { set: jest.fn() },
      escrowTotalCoinsHeld: { set: jest.fn() },
      escrowStaleHeldCount: { set: jest.fn() },
      setEscrowDegradedQueueSize: jest.fn(),
    };

    const mockSupabaseService = {
      getClient: jest.fn().mockReturnValue(mockSupabaseClient),
      getRedisClient: jest.fn().mockReturnValue(mockRedisClient),
    };

    const mockLogger = {
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowMetricsAggregator,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: 'PinoLogger:EscrowMetricsAggregator', useValue: mockLogger },
      ],
    }).compile();

    aggregator = module.get<EscrowMetricsAggregator>(EscrowMetricsAggregator);
  });

  describe('collectEscrowStats', () => {
    it('should set total held escrow count', async () => {
      mockSupabaseClient.select = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ count: 15, data: null }),
      });

      await aggregator.collectEscrowStats();

      expect(mockMetricsService.escrowTotalHeld.set).toHaveBeenCalledWith(15);
    });

    it('should set total held escrow count to 0 when count is null', async () => {
      mockSupabaseClient.select = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ count: null, data: null }),
      });

      await aggregator.collectEscrowStats();

      expect(mockMetricsService.escrowTotalHeld.set).toHaveBeenCalledWith(0);
    });

    it('should set total coins held in escrow', async () => {
      let selectChain: Record<string, jest.Mock> | null = null;

      mockSupabaseClient.from = jest
        .fn()
        .mockImplementation((table: string) => {
          selectChain = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn(),
          };

          if (table === 'escrow_transactions') {
            selectChain.eq = jest
              .fn()
              .mockImplementation((_field: string, value: string) => {
                if (value === 'held') {
                  return Promise.resolve({
                    count: 5,
                    data: [
                      { amount_coins: 100 },
                      { amount_coins: 200 },
                      { amount_coins: 50 },
                    ],
                  });
                }
                return Promise.resolve({ count: 0, data: [] });
              });
          }
          return selectChain;
        });

      await aggregator.collectEscrowStats();

      expect(mockMetricsService.escrowTotalCoinsHeld.set).toHaveBeenCalledWith(
        350,
      );
    });

    it('should set total coins held to 0 when no held rows exist', async () => {
      let selectChain: Record<string, jest.Mock> | null = null;

      mockSupabaseClient.from = jest
        .fn()
        .mockImplementation((_table: string) => {
          selectChain = {
            select: jest.fn().mockReturnThis(),
            eq: jest
              .fn()
              .mockImplementation((_field: string, value: string) => {
                if (value === 'held') {
                  return Promise.resolve({ count: 0, data: [] });
                }
                return Promise.resolve({ count: 0, data: [] });
              }),
            lt: jest.fn().mockResolvedValue({ count: 0, data: null }),
          };
          return selectChain;
        });

      await aggregator.collectEscrowStats();

      expect(mockMetricsService.escrowTotalCoinsHeld.set).toHaveBeenCalledWith(
        0,
      );
    });

    it('should set stale held escrow count', async () => {
      // We need to create an aggregator with a simplified mock for this specific test
      const mockSupabaseSvc = {
        getClient: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          lt: jest.fn().mockResolvedValue({ count: 8 }),
        }),
        getRedisClient: jest.fn().mockReturnValue({
          llen: jest.fn().mockResolvedValue(0),
        }),
      };

      const freshAggregator = new EscrowMetricsAggregator(
        { error: jest.fn() } as never,
        mockSupabaseSvc as never,
        mockMetricsService as never,
      );

      await freshAggregator.collectEscrowStats();

      // stale count was set
      expect(mockMetricsService.escrowStaleHeldCount.set).toHaveBeenCalledWith(
        8,
      );
    });

    it('should set degraded queue size from Redis', async () => {
      mockRedisClient.llen = jest.fn().mockResolvedValue(42);

      await aggregator.collectEscrowStats();

      expect(
        mockMetricsService.setEscrowDegradedQueueSize,
      ).toHaveBeenCalledWith(42);
    });

    it('should handle Redis failure gracefully', async () => {
      mockRedisClient.llen = jest
        .fn()
        .mockRejectedValue(new Error('Redis connection lost'));

      await aggregator.collectEscrowStats();

      // Should not throw; degraded queue metric just keeps last known value
      expect(
        mockMetricsService.setEscrowDegradedQueueSize,
      ).not.toHaveBeenCalled();
    });

    it('should handle Supabase failure gracefully', async () => {
      mockSupabaseClient.from = jest.fn().mockImplementation(() => {
        throw new Error('Database connection lost');
      });

      // Should not throw
      await expect(aggregator.collectEscrowStats()).resolves.toBeUndefined();
    });
  });
});
