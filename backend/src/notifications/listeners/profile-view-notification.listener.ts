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
    const recipientId = payload.viewedId;

    try {
      const shouldSend =
        await this.notificationPreferencesService.shouldSendNotification(
          recipientId,
          'profile_view',
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
