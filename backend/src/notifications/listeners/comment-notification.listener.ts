import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { NotificationPreferencesService } from '../notification-preferences.service';
import { MomentCommentEvent } from '../events/notification.events';

@Injectable()
export class CommentNotificationListener {
  private readonly logger = new Logger(CommentNotificationListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  @OnEvent('comment.moment')
  async handleCommentMoment(payload: MomentCommentEvent): Promise<void> {
    const recipientId = payload.momentAuthorId;

    const notifType = payload.parentCommentId ? 'reply_comment' : 'comment_moment';
    await this.notificationsService.createNotification(
      recipientId,
      payload.commenterId,
      notifType,
      payload.momentId,
      payload.commentPreview,
    );

    try {
      const shouldSend =
        await this.notificationPreferencesService.shouldSendNotification(
          recipientId,
          'moment_comment',
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

    const title = 'New Comment';
    const body = payload.commentPreview ?? 'Someone commented on your moment';
    await this.notificationsService.sendPushNotification(recipientId, {
      type: 'comment_moment',
      title,
      body,
      data: {},
    });
  }
}
