import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { MetricsModule } from '../metrics/metrics.module';
import { MatchmakingErrorBoundaryService } from './matchmaking-error-boundary.service';

@Module({
  imports: [SupabaseModule, MetricsModule],
  providers: [MatchmakingErrorBoundaryService],
  exports: [MatchmakingErrorBoundaryService],
})
export class MatchmakingModule {}