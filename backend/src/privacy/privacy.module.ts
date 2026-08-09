import { Module } from '@nestjs/common';
import { PrivacyService } from './privacy.service';
import { PrivacyController } from './privacy.controller';
import { DataScrubbingService } from './data-scrubbing.service';
import { DataRetentionService } from './data-retention.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { SafetyModule } from '../safety/safety.module';

@Module({
  imports: [SupabaseModule, SafetyModule],
  controllers: [PrivacyController],
  providers: [PrivacyService, DataScrubbingService, DataRetentionService],
  exports: [PrivacyService, DataScrubbingService],
})
export class PrivacyModule {}
