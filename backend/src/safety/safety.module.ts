import { Module } from '@nestjs/common';
import { SafetyController } from './safety.controller';
import { SafetyService } from './safety.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { MetricsModule } from '../metrics/metrics.module';
import { SafetyCacheInvalidationService } from './safety-cache-invalidation.service';
import { MutedWordsController } from './muted-words.controller';
import { MutedWordsService } from './muted-words.service';

@Module({
  imports: [SupabaseModule, MetricsModule],
  controllers: [SafetyController, MutedWordsController],
  providers: [SafetyService, SafetyCacheInvalidationService, MutedWordsService],
  exports: [SafetyService, SafetyCacheInvalidationService, MutedWordsService],
})
export class SafetyModule {}
