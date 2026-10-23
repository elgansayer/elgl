import { Module } from '@nestjs/common';
import { PrivacyService } from './privacy.service';
import { PrivacyController } from './privacy.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { SafetyModule } from '../safety/safety.module';
import { DataScrubbingService } from './data-scrubbing.service';
import { PrivacyArchiveCron } from './privacy-archive.cron';
import { DataRetentionService } from './data-retention.service';
import { PrivacyLifecycleService } from './privacy-lifecycle.service';

@Module({
  imports: [SupabaseModule, SafetyModule],
  controllers: [PrivacyController],
  providers: [
    PrivacyService,
    PrivacyLifecycleService,
    DataScrubbingService,
    PrivacyArchiveCron,
    DataRetentionService,
  ],
  exports: [PrivacyService, PrivacyLifecycleService, DataScrubbingService],
})
export class PrivacyModule {}
