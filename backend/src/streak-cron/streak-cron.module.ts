import { Module } from '@nestjs/common';
import { StreakCronService } from './streak-cron.service';

@Module({
  providers: [StreakCronService],
})
export class StreakCronModule {}
