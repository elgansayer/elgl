import { Module } from '@nestjs/common';
import { StudyBuddiesController } from './study-buddies.controller';
import { StudyBuddiesService } from './study-buddies.service';
import { StudyBuddiesRateLimiterGuard } from './study-buddies-rate-limiter.guard';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [StudyBuddiesController],
  providers: [StudyBuddiesService, StudyBuddiesRateLimiterGuard],
  exports: [StudyBuddiesService],
})
export class StudyBuddiesModule {}
