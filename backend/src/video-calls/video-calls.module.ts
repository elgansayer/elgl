import { Module } from '@nestjs/common';
import { VideoCallsController } from './video-calls.controller';
import { VideoCallsService } from './video-calls.service';
import { VideoCallsCacheInvalidationService } from './video-calls-cache-invalidation.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [VideoCallsController],
  providers: [VideoCallsService, VideoCallsCacheInvalidationService],
  exports: [VideoCallsService, VideoCallsCacheInvalidationService],
})
export class VideoCallsModule {}
