import { Module } from '@nestjs/common';
import { VideoCallsController } from './video-calls.controller';
import { VideoCallsService } from './video-calls.service';
import { VideoCallsDegradationService } from './video-calls-degradation.service';
import { VideoCallsCacheInvalidationService } from './video-calls-cache-invalidation.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LivekitModule } from '../livekit/livekit.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [SupabaseModule, LivekitModule, MetricsModule],
  controllers: [VideoCallsController],
  providers: [
    VideoCallsService,
    VideoCallsDegradationService,
    VideoCallsCacheInvalidationService,
  ],
  exports: [
    VideoCallsService,
    VideoCallsDegradationService,
    VideoCallsCacheInvalidationService,
  ],
})
export class VideoCallsModule {}
