import { Module } from '@nestjs/common';
import { SafetyController } from './safety.controller';
import { SafetyService } from './safety.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { MetricsModule } from '../metrics/metrics.module';
import { SafetyCacheInvalidationService } from './safety-cache-invalidation.service';

@Module({
  imports: [SupabaseModule, MetricsModule],
  controllers: [SafetyController],
  providers: [SafetyService, SafetyCacheInvalidationService],
  exports: [SafetyService, SafetyCacheInvalidationService],
})
export class SafetyModule {}
