import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { NotificationPreferencesService } from '../notification-preferences.service';
import { FollowEvent } from '../events/notification.events';

@Injectable()
export class FollowNotificationListener {
  private readonly logger = new Logger(FollowNotificationListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  @OnEvent('user.follow')
  async handleFollow(payload: FollowEvent): Promise<void> {
    const recipientId = payload.followedUserId;

    await this.notificationsService.createNotification(
      recipientId,
      payload.followerId,
      'follow',
    );

    try {
      const shouldSend =
        await this.notificationPreferencesService.shouldSendNotification(
          recipientId,
          'new_follower',
          'push',
        );
      if (!shouldSend) {
        return;
      }
    } catch (err) {
      this.logger.error(
        `Failed to check notification preferences for user ${recipientId}:`,
        err,
      );
    }

    const title = 'New Follower';
    const body = 'Someone started following you';
    await this.notificationsService.sendPushNotification(recipientId, {
      type: 'follow',
      title,
      body,
      data: {},
      category: 'likes',
    });
  }
}