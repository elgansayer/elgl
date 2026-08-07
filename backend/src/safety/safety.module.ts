import { Module } from '@nestjs/common';
import { SafetyController } from './safety.controller';
import { SafetyService } from './safety.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { SafetyCacheInvalidationService } from './safety-cache-invalidation.service';

@Module({
  imports: [SupabaseModule],
  controllers: [SafetyController],
  providers: [SafetyService, SafetyCacheInvalidationService],
  exports: [SafetyService, SafetyCacheInvalidationService],
})
export class SafetyModule {}
