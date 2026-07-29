import { Module } from '@nestjs/common';
import { SpamDetectionService } from './spam-detection.service';

@Module({
  providers: [SpamDetectionService],
  exports: [SpamDetectionService],
})
export class SpamDetectionModule {}
