import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationPreferencesService } from './notification-preferences.service';
import { ChatNotificationListener } from './listeners/chat-notification.listener';
import { CommentNotificationListener } from './listeners/comment-notification.listener';
import { ProfileViewNotificationListener } from './listeners/profile-view-notification.listener';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [NotificationPreferencesController],
  providers: [
    NotificationsService,
    NotificationPreferencesService,
    ChatNotificationListener,
    CommentNotificationListener,
    ProfileViewNotificationListener,
  ],
  exports: [NotificationsService, NotificationPreferencesService],
})
export class NotificationsModule {}
