import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { NotificationPreferencesService } from '../notification-preferences.service';

@Injectable()
export class ProfileViewNotificationListener {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  @OnEvent('profile.visit')
  async handleProfileVisit(payload: {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<void> {
    try {
      const prefs = await this.notificationPreferencesService.getPreferences(
        payload.userId,
      );
      const category = prefs?.profile_view;
      if (category && category.push === false) {
        return;
      }
    } catch (err) {
      console.error(
        `Failed to check notification preferences for user ${payload.userId}:`,
        err,
      );
    }

    await this.notificationsService.sendPushNotification(payload.userId, {
      type: 'profile_visit',
      title: payload.title || 'Profile Visit',
      body: payload.body,
      data: { ...(payload.data || {}) },
    });
  }
}
