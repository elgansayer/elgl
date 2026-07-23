import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { EconomyController } from './economy.controller';
import { EconomyService } from './economy.service';
import { AppleNotificationController } from './apple-notification.controller';
import { AppleNotificationService } from './apple-notification.service';

@Module({
  imports: [UsersModule, ChatModule, HttpModule],
  controllers: [EconomyController, AppleNotificationController],
  providers: [EconomyService, AppleNotificationService],
  exports: [EconomyService, AppleNotificationService],
})
export class EconomyModule {}
