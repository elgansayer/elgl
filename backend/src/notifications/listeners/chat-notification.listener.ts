import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { NotificationPreferencesService } from '../notification-preferences.service';
import { ChatMessageEvent } from '../events/notification.events';

@Injectable()
export class ChatNotificationListener {
  private readonly logger = new Logger(ChatNotificationListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  @OnEvent('chat.message')
  async handleChatMessage(payload: ChatMessageEvent): Promise<void> {
    const recipientId = payload.receiverId;

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
      this.logger.error(
        `Failed to check notification preferences for user ${recipientId}:`,
        err,
      );
    }

    const title = 'New Message';
    const body = payload.preview || '';
    await this.notificationsService.sendPushNotification(recipientId, {
      type: 'chat_message',
      title,
      body,
      data: {},
    });
  }
}
