import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { NotificationPreferencesService } from '../notification-preferences.service';

@Injectable()
export class CommentNotificationListener {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  @OnEvent('comment.moment')
  async handleCommentMoment(payload: {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<void> {
    try {
      const prefs = await this.notificationPreferencesService.getPreferences(
        payload.userId,
      );
      const category = prefs?.moment_comment;
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
      type: 'comment_moment',
      title: payload.title || 'New Comment',
      body: payload.body,
      data: { ...(payload.data || {}) },
    });
  }
}
