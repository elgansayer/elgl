import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { NotificationPreferencesService } from '../notification-preferences.service';
import { ChatMentionEvent } from '../events/notification.events';

@Injectable()
export class ChatMentionNotificationListener {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  @OnEvent('chat.mention')
  async handleChatMention(payload: ChatMentionEvent): Promise<void> {
    const recipientId = payload.mentionedUserId;

    try {
      const shouldSend =
        await this.notificationPreferencesService.shouldSendNotification(
          recipientId,
          'new_message',
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
      payload.actorId,
      'mention_chat',
      payload.roomId,
      payload.messagePreview,
    );
  }
}
