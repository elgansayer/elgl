import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { EconomyController } from './economy.controller';
import { EconomyService } from './economy.service';
import { EconomyExceptionFilter } from './economy-exception.filter';
import { EconomyRateLimiterGuard } from './economy-rate-limiter.guard';
import { AppleNotificationService } from './apple-notification.service';
import { GooglePlayNotificationService } from './google-play-notification.service';

@Module({
  imports: [UsersModule, ChatModule, HttpModule],
  controllers: [EconomyController],
  providers: [
    EconomyService,
    EconomyRateLimiterGuard,
    AppleNotificationService,
    GooglePlayNotificationService,
    EconomyExceptionFilter,
  ],
  exports: [EconomyService],
})
export class EconomyModule {}
