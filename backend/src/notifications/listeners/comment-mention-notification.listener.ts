import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { NotificationPreferencesService } from '../notification-preferences.service';
import { MomentCommentEvent } from '../events/notification.events';

@Injectable()
export class CommentMentionNotificationListener {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  @OnEvent('moment.mention')
  async handleCommentMention(payload: MomentCommentEvent): Promise<void> {
    // Use mentionedUserIds array if populated, otherwise fall back to momentAuthorId for backward compatibility
    const recipientIds = payload.mentionedUserIds?.length
      ? payload.mentionedUserIds
      : payload.momentAuthorId
        ? [payload.momentAuthorId]
        : [];

    const validRecipients = recipientIds.filter(
      (id) => id !== payload.commenterId,
    );

    // ⚡ Bolt Optimization: Grouped sequential database queries into a concurrent Promise.all execution to reduce latency.
    await Promise.all(
      validRecipients.map(async (recipientId) => {
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
          console.error(
            `Failed to check notification preferences for user ${recipientId}:`,
            err,
          );
        }

        await this.notificationsService.createNotification(
          recipientId,
          payload.commenterId,
          'mention_comment',
          payload.momentId,
          payload.commentPreview,
        );
      }),
    );
  }
}
