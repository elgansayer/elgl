import { Module } from '@nestjs/common';
import { NotificationPreferencesController } from '../notifications/notification-preferences.controller';
import { NotificationPreferencesService } from '../notifications/notification-preferences.service';

@Module({
  controllers: [NotificationPreferencesController],
  providers: [NotificationPreferencesService],
})
export class NotificationPreferencesModule {}
