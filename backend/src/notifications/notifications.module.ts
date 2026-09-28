import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsInboxService } from './notifications-inbox.service';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationPreferencesService } from './notification-preferences.service';
import { ChatNotificationListener } from './listeners/chat-notification.listener';
import { ChatMentionNotificationListener } from './listeners/chat-mention-notification.listener';
import { CommentNotificationListener } from './listeners/comment-notification.listener';
import { CommentMentionNotificationListener } from './listeners/comment-mention-notification.listener';
import { ProfileViewNotificationListener } from './listeners/profile-view-notification.listener';
import { FollowNotificationListener } from './listeners/follow-notification.listener';
import { LikeNotificationListener } from './listeners/like-notification.listener';
import { SystemNotificationListener } from './listeners/system-notification.listener';
import { SupabaseModule } from '../supabase/supabase.module';

import { NotificationsController } from './notifications.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [NotificationsController, NotificationPreferencesController],
  providers: [
    NotificationsService,
    NotificationsInboxService,
    NotificationPreferencesService,
    ChatNotificationListener,
    ChatMentionNotificationListener,
    CommentNotificationListener,
    CommentMentionNotificationListener,
    ProfileViewNotificationListener,
    FollowNotificationListener,
    LikeNotificationListener,
    SystemNotificationListener,
  ],
  exports: [NotificationsService, NotificationPreferencesService],
})
export class NotificationsModule {}
