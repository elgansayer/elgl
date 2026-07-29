import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { NotificationPreferencesService } from '../notification-preferences.service';

@Injectable()
export class ChatNotificationListener {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  @OnEvent('chat.message')
  async handleChatMessage(payload: {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<void> {
    try {
      const prefs = await this.notificationPreferencesService.getPreferences(
        payload.userId,
      );
      const category = prefs?.new_message;
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
      type: 'chat_message',
      title: payload.title || 'New Message',
      body: payload.body,
      data: { ...(payload.data || {}) },
    });
  }
}
