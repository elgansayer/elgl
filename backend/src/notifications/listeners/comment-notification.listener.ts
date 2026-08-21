import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { NotificationPreferencesService } from '../notification-preferences.service';
import { MomentCommentEvent } from '../events/notification.events';

@Injectable()
export class CommentNotificationListener {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  @OnEvent('comment.moment')
  async handleCommentMoment(payload: MomentCommentEvent): Promise<void> {
    const recipientId = payload.momentAuthorId;

    // Guard against self-comments
    if (recipientId === payload.commenterId) return;

    let shouldPush = true;
    let shouldInApp = true;
    try {
      shouldPush =
        await this.notificationPreferencesService.shouldSendNotification(
          recipientId,
          'moment_comment',
          'push',
        );
      shouldInApp =
        await this.notificationPreferencesService.shouldSendNotification(
          recipientId,
          'moment_comment',
          'in_app',
        );
    } catch (err) {
      console.error(
        `Failed to check notification preferences for user ${recipientId}:`,
        err,
      );
    }

    const message = payload.commentPreview ?? undefined;
    const type = payload.parentCommentId ? 'reply_comment' : 'comment_moment';

    // Create in-app notification
    if (shouldInApp) {
      await this.notificationsService
        .createNotification(
          recipientId,
          payload.commenterId,
          type,
          payload.momentId,
          message,
        )
        .catch((err: unknown) =>
          console.error('Failed to create in-app notification:', err),
        );
    }

    // Send push notification
    if (shouldPush) {
      const title = 'New Comment';
      const body = payload.commentPreview ?? 'Someone commented on your moment';
      await this.notificationsService.sendPushNotification(recipientId, {
        type: 'comment_moment',
        title,
        body,
        data: {},
        category: 'groups',
      });
    }
  }
}
