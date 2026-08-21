import { Module } from '@nestjs/common';
import { PrivacyService } from './privacy.service';
import { PrivacyController } from './privacy.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { SafetyModule } from '../safety/safety.module';
import { DataScrubbingService } from './data-scrubbing.service';

@Module({
  imports: [SupabaseModule, SafetyModule],
  controllers: [PrivacyController],
  providers: [PrivacyService, DataScrubbingService],
  exports: [PrivacyService, DataScrubbingService],
})
export class PrivacyModule {}
