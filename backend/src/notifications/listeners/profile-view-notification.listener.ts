import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { NotificationPreferencesService } from '../notification-preferences.service';
import { ProfileViewEvent } from '../events/notification.events';

@Injectable()
export class ProfileViewNotificationListener {
  private readonly logger = new Logger(ProfileViewNotificationListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  @OnEvent('profile.visit')
  async handleProfileVisit(payload: ProfileViewEvent): Promise<void> {
    const recipientId = payload.viewedUserId;

    // Create in-app notification
    await this.notificationsService.createNotification(
      recipientId,
      payload.viewerId,
      'profile_visit',
    );

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
      this.logger.error(
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
