import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { FollowEvent } from '../events/notification.events';

@Injectable()
export class FollowNotificationListener {
<<<<<<< HEAD
  private readonly logger = new Logger(FollowNotificationListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}
=======
  constructor(private readonly notificationsService: NotificationsService) {}
>>>>>>> origin/main

  @OnEvent('user.followed')
  async handleFollow(payload: FollowEvent): Promise<void> {
<<<<<<< HEAD
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
=======
    await this.notificationsService.createNotification(
      payload.followedUserId,
      payload.followerId,
      'follow',
    );
>>>>>>> origin/main
  }
}
