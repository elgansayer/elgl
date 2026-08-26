import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { NotificationPreferencesService } from '../notification-preferences.service';
import { MomentCommentEvent } from '../events/notification.events';

const MAX_MENTION_RECIPIENTS = 20;

@Injectable()
export class CommentMentionNotificationListener {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  @OnEvent('moment.mention')
  async handleCommentMention(payload: MomentCommentEvent): Promise<void> {
    const candidateRecipientIds = payload.mentionedUserIds?.length
      ? payload.mentionedUserIds
      : payload.momentAuthorId
        ? [payload.momentAuthorId]
        : [];

    const recipientIds = Array.from(new Set(candidateRecipientIds))
      .filter((recipientId) => recipientId && recipientId !== payload.commenterId)
      .slice(0, MAX_MENTION_RECIPIENTS);

    for (const recipientId of recipientIds) {
      let shouldSend: boolean;
      try {
        shouldSend =
          await this.notificationPreferencesService.shouldSendNotification(
            recipientId,
            'moment_comment',
            'push',
          );
      } catch {
        // Mention notifications are best-effort, but preference lookup failures
        // must fail closed rather than bypassing a user's notification choices.
        console.warn(
          'Moment mention preference lookup failed; notification suppressed.',
        );
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
        // Isolate recipients so a transient failure for one mention never
        // prevents delivery to the remaining bounded recipient set.
        console.warn('Moment mention notification delivery failed.');
      }
    }
  }
}
