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

  @OnEvent('moment.comment')
  async handleCommentMoment(payload: MomentCommentEvent): Promise<void> {
    const recipientId = payload.momentAuthorId;

    // Guard against missing recipient or self-comments
    if (!recipientId || recipientId === payload.commenterId) return;

    let shouldPush: boolean;
    let shouldInApp: boolean;
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
    } catch {
      // Preferences are a privacy boundary: fail closed when they cannot be
      // read, and keep user identifiers out of the diagnostic.
      this.logger.warn('comment_preferences_unavailable');
      return;
    }
    if (!shouldPush && !shouldInApp) return;

    const message = payload.commentPreview ?? undefined;
    // The author is only told "replied to your comment" when the reply really
    // targets their own comment; any other reply on their moment is a comment.
    const type =
      payload.parentCommentId && payload.replyToUserId === recipientId
        ? 'reply_comment'
        : 'comment_moment';

    // Create the in-app row without its built-in push: the explicit push below
    // honours the per-category push, quiet-hours and DND preferences, and a
    // second dispatch would notify the author twice for one comment.
    if (shouldInApp) {
      await this.notificationsService
        .createNotification(
          recipientId,
          payload.commenterId,
          type,
          payload.momentId,
          message,
          false,
        )
        .catch(() => {
          this.logger.warn('comment_in_app_notification_failed');
        });
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
