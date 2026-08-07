import { Module } from '@nestjs/common';
import { VideoCallsController } from './video-calls.controller';
import { VideoCallsService } from './video-calls.service';
import { SharedLoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [SharedLoggerModule],
  controllers: [VideoCallsController],
  providers: [VideoCallsService],
  exports: [VideoCallsService],
})
export class VideoCallsModule {}
