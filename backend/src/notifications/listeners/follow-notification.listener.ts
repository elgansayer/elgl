import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { NotificationPreferencesService } from '../notification-preferences.service';
import { FollowEvent } from '../events/notification.events';

@Injectable()
export class FollowNotificationListener {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  @OnEvent('user.follow')
  async handleFollow(payload: FollowEvent): Promise<void> {
    const recipientId = payload.followedUserId;

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
      console.error(
        `Failed to check notification preferences for user ${recipientId}:`,
        err,
      );
    }

    await this.notificationsService.createNotification(
      recipientId,
      payload.followerId,
      'follow',
    );
  }
}