import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { EconomyController } from './economy.controller';
import { EconomyService } from './economy.service';
import { AppleNotificationController } from './apple-notification.controller';
import { AppleNotificationService } from './apple-notification.service';
import { GooglePlayNotificationController } from './google-play-notification.controller';
import { GooglePlayNotificationService } from './google-play-notification.service';

@Module({
  imports: [UsersModule, ChatModule, HttpModule],
  controllers: [
    EconomyController,
    AppleNotificationController,
    GooglePlayNotificationController,
  ],
  providers: [
    EconomyService,
    AppleNotificationService,
    GooglePlayNotificationService,
  ],
  exports: [
    EconomyService,
    AppleNotificationService,
    GooglePlayNotificationService,
  ],
})
export class EconomyModule {}
