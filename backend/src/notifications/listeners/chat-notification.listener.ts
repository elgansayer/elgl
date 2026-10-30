import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { NotificationPreferencesService } from '../notification-preferences.service';
import {
  ChatMessageEvent,
  UnreadCountsChangedEvent,
} from '../events/notification.events';

@Injectable()
export class ChatNotificationListener {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('chat.message')
  async handleChatMessage(payload: ChatMessageEvent): Promise<void> {
    const recipientId = payload.receiverId;

    if (recipientId === payload.senderId) return;

    // ChatService emits this event only after the message insert succeeds.
    this.eventEmitter.emit(
      'unread.counts_changed',
      new UnreadCountsChangedEvent(recipientId, 'chat'),
    );

    let shouldPush = true;
    try {
      shouldPush =
        await this.notificationPreferencesService.shouldSendNotification(
          recipientId,
          'new_message',
          'push',
        );
    } catch (err) {
      console.error(
        `Failed to check notification preferences for user ${recipientId}:`,
        err,
      );
    }

    // Create in-app notification for chat messages (always, preferences control push only)
    await this.notificationsService
      .createNotification(
        recipientId,
        payload.senderId,
        'mention_chat',
        payload.roomId,
        payload.preview,
      )
      .catch((err: unknown) =>
        console.error('Failed to create in-app chat notification:', err),
      );

    // Send push notification
    if (shouldPush) {
      const title = 'New Message';
      const body = payload.preview || '';
      await this.notificationsService.sendPushNotification(recipientId, {
        type: 'chat_message',
        title,
        body,
        data: {},
        category: 'direct_messages',
      });
    }
  }
}
