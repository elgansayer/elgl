import { Module } from '@nestjs/common';
import { StudyBuddiesController } from './study-buddies.controller';
import { StudyBuddiesService } from './study-buddies.service';

@Module({
  controllers: [StudyBuddiesController],
  providers: [StudyBuddiesService],
  exports: [StudyBuddiesService],
})
export class StudyBuddiesModule {}
