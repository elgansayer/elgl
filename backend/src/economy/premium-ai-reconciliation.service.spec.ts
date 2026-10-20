import { PremiumAiReconciliationService } from './premium-ai-reconciliation.service';

describe('PremiumAiReconciliationService', () => {
  it('runs bounded stale-run reconciliation', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 2, error: null });
    const service = new PremiumAiReconciliationService({
      getClient: () => ({ rpc }),
    } as never);

    await service.refundStaleRuns();

    expect(rpc).toHaveBeenCalledWith('refund_stale_premium_ai_runs', {
      p_limit: 100,
    });
  });

  it('contains database errors without throwing from the cron worker', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '08006', message: 'database connection failed' },
    });
    const service = new PremiumAiReconciliationService({
      getClient: () => ({ rpc }),
    } as never);

    await expect(service.refundStaleRuns()).resolves.toBeUndefined();
  });
});
