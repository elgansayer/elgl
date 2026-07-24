import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { ChatMessageEvent } from '../events/notification.events';
import { SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class ChatNotificationListener {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @OnEvent('chat.message')
  async handleChatMessage(event: ChatMessageEvent): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient() as SupabaseClient;

      const { senderId, messageType, receiverId, messagePreview, roomId } =
        event as any;

      const { data: sender } = await supabase
        .from('users')
        .select('display_name, avatar_url')
        .eq('id', senderId)
        .single();

      if (!sender) return;

      const senderName = sender.display_name || 'Someone';
      const messageTypeLabels: Record<string, string> = {
        text: 'sent a message',
        voice: 'sent a voice note',
        correction: 'sent a correction',
        doodle: 'sent a doodle',
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const actionLabel = messageTypeLabels[messageType] || 'sent a message';

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await this.notificationsService.sendPushNotification(receiverId, {
        type: 'new_message',
        title: senderName,
        body: `${actionLabel}: ${messagePreview}`,
        data: {
          channel: roomId,
          sender_id: senderId,
          sender_name: senderName,

          sender_avatar: sender.avatar_url || '',
          room_id: roomId,
        },
      });
    } catch (err) {
      console.error('Chat notification listener error:', err);
    }
  }
}
