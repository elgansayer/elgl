import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { ChatMessageEvent } from '../events/notification.events';

@Injectable()
export class ChatNotificationListener {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @OnEvent('chat.message')
  async handleChatMessage(event: ChatMessageEvent): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();
      const { data: sender } = await supabase
        .from('users')
        .select('display_name, avatar_url')
        .eq('id', event.senderId)
        .single();

      if (!sender) return;

      const senderName = sender.display_name || 'Someone';
      const messageTypeLabels: Record<string, string> = {
        text: 'sent a message',
        voice: 'sent a voice note',
        correction: 'sent a correction',
        doodle: 'sent a doodle',
      };

      const actionLabel =
        messageTypeLabels[event.messageType] || 'sent a message';

      await this.notificationsService.sendPushNotification(event.receiverId, {
        type: 'new_message',
        title: senderName,
        body: `${actionLabel}: ${event.messagePreview}`,
        data: {
          channel: event.roomId,
          sender_id: event.senderId,
          sender_name: senderName,
          sender_avatar: sender.avatar_url || '',
          room_id: event.roomId,
        },
      });
    } catch (err) {
      console.error('Chat notification listener error:', err);
    }
  }
}
