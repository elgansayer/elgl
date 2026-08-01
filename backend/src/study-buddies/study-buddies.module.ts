import { Module } from '@nestjs/common';
import { StudyBuddiesController } from './study-buddies.controller';
import { StudyBuddiesService } from './study-buddies.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [StudyBuddiesController],
  providers: [StudyBuddiesService],
  exports: [StudyBuddiesService],
})
export class StudyBuddiesModule {}
