import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { NotificationPreferencesService } from '../notification-preferences.service';
import { ProfileViewEvent } from '../events/notification.events';

@Injectable()
export class ProfileViewNotificationListener {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  @OnEvent('profile.visit')
  async handleProfileVisit(payload: ProfileViewEvent): Promise<void> {
    const recipientId = payload.viewedUserId;

    if (recipientId === payload.viewerId) return;

    let shouldPush = true;
    let shouldInApp = true;
    try {
      shouldPush =
        await this.notificationPreferencesService.shouldSendNotification(
          recipientId,
          'profile_view',
          'push',
        );
      shouldInApp =
        await this.notificationPreferencesService.shouldSendNotification(
          recipientId,
          'profile_view',
          'in_app',
        );
    } catch (err) {
      console.error(
        `Failed to check notification preferences for user ${recipientId}:`,
        err,
      );
    }

    // Create in-app notification
    if (shouldInApp) {
      await this.notificationsService
        .createNotification(recipientId, payload.viewerId, 'profile_visit')
        .catch((err: unknown) =>
          console.error(
            'Failed to create in-app profile view notification:',
            err,
          ),
        );
    }

    // Send push notification
    if (shouldPush) {
      const title = 'Profile Visit';
      const body = 'Someone viewed your profile';
      await this.notificationsService.sendPushNotification(recipientId, {
        type: 'profile_visit',
        title,
        body,
        data: {},
      });
    }
  }
}
