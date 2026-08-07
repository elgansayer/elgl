import { Module } from '@nestjs/common';
import { VideoCallsController } from './video-calls.controller';
import { VideoCallsService } from './video-calls.service';
import { VideoCallsRateLimiterGuard } from './video-calls-rate-limiter.guard';

@Module({
  controllers: [VideoCallsController],
  providers: [VideoCallsService, VideoCallsRateLimiterGuard],
  exports: [VideoCallsService],
})
export class VideoCallsModule {}
