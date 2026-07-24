import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { SafetyModule } from '../safety/safety.module';
import { MomentsController } from './moments.controller';
import { MomentsService } from './moments.service';
import { TimelineWorker } from './timeline.worker';

@Module({
  imports: [UsersModule, SafetyModule],
  controllers: [MomentsController],
  providers: [MomentsService, TimelineWorker],
  exports: [MomentsService, TimelineWorker],
})
export class MomentsModule {}
