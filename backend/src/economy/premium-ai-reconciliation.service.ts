import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class PremiumAiReconciliationService {
  private readonly logger = new Logger(PremiumAiReconciliationService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  @Cron('*/5 * * * *')
  async refundStaleRuns(): Promise<void> {
    const { data, error } = await this.supabaseService
      .getClient()
      .rpc('refund_stale_premium_ai_runs', { p_limit: 100 });

    if (error) {
      this.logger.warn(
        `Premium AI stale-run reconciliation failed (${error.code ?? 'unknown'})`,
      );
      return;
    }

    const refunded = typeof data === 'number' ? data : Number(data ?? 0);
    if (Number.isFinite(refunded) && refunded > 0) {
      this.logger.warn(`Premium AI stale-run reconciliation refunded ${refunded} run(s)`);
    }
  }
}
