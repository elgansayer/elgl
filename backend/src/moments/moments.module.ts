import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { MomentsController } from './moments.controller';
import { MomentsService } from './moments.service';
import { TimelineWorker } from './timeline.worker';

@Module({
  imports: [UsersModule],
  controllers: [MomentsController],
  providers: [MomentsService, TimelineWorker],
  exports: [MomentsService, TimelineWorker],
})
export class MomentsModule {}
