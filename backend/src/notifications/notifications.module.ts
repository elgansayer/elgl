import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ChatNotificationListener } from './listeners/chat-notification.listener';
import { CommentNotificationListener } from './listeners/comment-notification.listener';
import { ProfileViewNotificationListener } from './listeners/profile-view-notification.listener';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [
    NotificationsService,
    ChatNotificationListener,
    CommentNotificationListener,
    ProfileViewNotificationListener,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
