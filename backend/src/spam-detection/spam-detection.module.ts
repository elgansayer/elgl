import { Module } from '@nestjs/common';
import { SpamDetectionService } from './spam-detection.service';
import { SpamDetectionController } from './spam-detection.controller';

@Module({
  controllers: [SpamDetectionController],
  providers: [SpamDetectionService],
  exports: [SpamDetectionService],
})
export class SpamDetectionModule {}
