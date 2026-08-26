import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { NotificationPreferencesService } from '../notification-preferences.service';
import { MomentCommentEvent } from '../events/notification.events';

const MAX_MENTION_RECIPIENTS = 10;

@Injectable()
export class CommentMentionNotificationListener {
  private readonly logger = new Logger(CommentMentionNotificationListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  @OnEvent('moment.mention')
  async handleCommentMention(payload: MomentCommentEvent): Promise<void> {
    // Use mentionedUserIds array if populated, otherwise fall back to momentAuthorId for backward compatibility.
    // De-duplicate and bound recipients so repeated mentions cannot create duplicate notifications or unbounded fan-out.
    const recipientIds = Array.from(
      new Set(
        (payload.mentionedUserIds?.length
          ? payload.mentionedUserIds
          : payload.momentAuthorId
            ? [payload.momentAuthorId]
            : []
        ).filter(Boolean),
      ),
    ).slice(0, MAX_MENTION_RECIPIENTS);

    for (const recipientId of recipientIds) {
      // Guard against self-mentions (commenter mentioning themselves).
      if (recipientId === payload.commenterId) {
        continue;
      }

      let shouldSend: boolean;
      try {
        shouldSend =
          await this.notificationPreferencesService.shouldSendNotification(
            recipientId,
            'moment_comment',
            'push',
          );
      } catch {
        // Notification preferences are a privacy boundary. Fail closed when
        // their authoritative state is unavailable and avoid logging user IDs
        // or provider errors from a private comment-notification path.
        this.logger.warn('comment_mention_preferences_unavailable');
        continue;
      }

      if (!shouldSend) {
        continue;
      }

      try {
        await this.notificationsService.createNotification(
          recipientId,
          payload.commenterId,
          'mention_comment',
          payload.momentId,
          payload.commentPreview,
        );
      } catch {
        // A storage/provider failure for one mention must not prevent other
        // mentioned recipients from being processed. Keep diagnostics free of
        // user IDs, Moment IDs and comment text.
        this.logger.warn('comment_mention_delivery_failed');
      }
    }
  }
}
