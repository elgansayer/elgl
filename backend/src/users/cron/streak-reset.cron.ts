import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from '../users.service';

@Injectable()
export class StreakResetCron {
  private readonly logger = new Logger(StreakResetCron.name);

  constructor(private readonly usersService: UsersService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  handleCron() {
    this.logger.debug('Running streak reset cron job');
    // Actual implementation to reset streaks
  }
}
