import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { MetricsModule } from '../metrics/metrics.module';
import { EconomyController } from './economy.controller';
import { EconomyService } from './economy.service';
import { AppleNotificationService } from './apple-notification.service';
import { GooglePlayNotificationService } from './google-play-notification.service';

@Module({
  imports: [UsersModule, ChatModule, HttpModule, MetricsModule],
  controllers: [EconomyController],
  providers: [
    EconomyService,
    AppleNotificationService,
    GooglePlayNotificationService,
  ],
  exports: [EconomyService],
})
export class EconomyModule {}
