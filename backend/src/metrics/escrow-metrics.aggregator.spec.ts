import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EscrowMetricsAggregator } from './escrow-metrics.aggregator';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from './metrics.service';
import { PinoLogger } from 'nestjs-pino';

describe('EscrowMetricsAggregator', () => {
  let aggregator: EscrowMetricsAggregator;
  let mockMetricsService: Record<string, Mock>;
  let mockSupabaseService: Record<string, Mock>;
  let mockRedisClient: Record<string, Mock>;

  function createSelectChain() {
    const eqResult: unknown = null;
    const chain: Record<string, Mock> = {
      select: vi.fn(),
      eq: vi.fn(),
      lt: vi.fn(),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.lt.mockResolvedValue(chain);
    return chain;
  }

  beforeEach(async () => {
    mockRedisClient = {
      llen: vi.fn().mockResolvedValue(0),
    };

    mockMetricsService = {
      escrowTotalHeld: { set: vi.fn() },
      escrowTotalCoinsHeld: { set: vi.fn() },
      escrowStaleHeldCount: { set: vi.fn() },
      setEscrowDegradedQueueSize: vi.fn(),
    };

    const mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      log: vi.fn(),
      setContext: vi.fn(),
    };

    const chain1 = createSelectChain();
    chain1.select = vi.fn().mockReturnValue(chain1);
    chain1.eq = vi.fn().mockResolvedValue({ count: 0 });
    const chain2 = createSelectChain();
    chain2.select = vi.fn().mockReturnValue(chain2);
    chain2.eq = vi.fn().mockResolvedValue({ data: [] });
    const chain3 = createSelectChain();
    chain3.select = vi.fn().mockReturnValue(chain3);
    chain3.eq = vi.fn().mockReturnValue(chain3);
    chain3.lt = vi.fn().mockResolvedValue({ count: 0 });

    const supabaseClient = {
      from: vi.fn(),
    };
    supabaseClient.from
      .mockReturnValueOnce(chain1)
      .mockReturnValueOnce(chain2)
      .mockReturnValueOnce(chain3);

    mockSupabaseService = {
      getClient: vi.fn().mockReturnValue(supabaseClient),
      getRedisClient: vi.fn().mockReturnValue(mockRedisClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowMetricsAggregator,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: PinoLogger, useValue: mockLogger },
        { provide: 'PinoLogger:EscrowMetricsAggregator', useValue: mockLogger },
      ],
    }).compile();

    aggregator = module.get<EscrowMetricsAggregator>(EscrowMetricsAggregator);
  });

  it('should be defined', () => {
    expect(aggregator).toBeDefined();
  });

  it('should run collectEscrowStats without throwing', async () => {
    await expect(aggregator.collectEscrowStats()).resolves.toBeUndefined();
  });

  it('should query supabase for escrow stats', async () => {
    await aggregator.collectEscrowStats();
    expect(mockSupabaseService.getClient).toHaveBeenCalled();
    expect(mockMetricsService.escrowTotalHeld.set).toHaveBeenCalled();
    expect(mockMetricsService.escrowTotalCoinsHeld.set).toHaveBeenCalled();
    expect(mockMetricsService.escrowStaleHeldCount.set).toHaveBeenCalled();
  });

  it('should query Redis for degraded queue size', async () => {
    mockRedisClient.llen.mockResolvedValue(42);
    await aggregator.collectEscrowStats();
    expect(mockRedisClient.llen).toHaveBeenCalledWith('escrow_degraded_queue');
    expect(mockMetricsService.setEscrowDegradedQueueSize).toHaveBeenCalledWith(
      42,
    );
  });

  it('should handle Redis errors gracefully', async () => {
    mockRedisClient.llen.mockRejectedValue(new Error('Redis unavailable'));
    await expect(aggregator.collectEscrowStats()).resolves.toBeUndefined();
  });
});
