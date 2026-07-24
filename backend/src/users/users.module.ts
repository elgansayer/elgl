import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MediaService } from '../media/media.service';
import { StreakResetCron } from './cron/streak-reset.cron';

@Module({
  imports: [
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    ScheduleModule.forRoot(),
  ],
  controllers: [UsersController],
  providers: [UsersService, MediaService, StreakResetCron],
  exports: [UsersService],
})
export class UsersModule {}
