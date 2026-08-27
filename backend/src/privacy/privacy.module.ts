import { Module } from '@nestjs/common';
import { PrivacyService } from './privacy.service';
import { PrivacyController } from './privacy.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { SafetyModule } from '../safety/safety.module';
import { DataScrubbingService } from './data-scrubbing.service';
import { PrivacyArchiveCron } from './privacy-archive.cron';

@Module({
  imports: [SupabaseModule, SafetyModule],
  controllers: [PrivacyController],
  providers: [PrivacyService, DataScrubbingService, PrivacyArchiveCron],
  exports: [PrivacyService, DataScrubbingService],
})
export class PrivacyModule {}
