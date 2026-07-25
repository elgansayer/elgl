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
        event as unknown as {
          senderId: string;
          messageType: string;
          receiverId: string;
          messagePreview: string;
          roomId: string;
        };

      const { data: sender } = await supabase
        .from('users')
        .select('display_name, avatar_url')
        .eq('id', senderId)
        .single();

      if (!sender) return;

      const senderData = sender as {
        display_name?: string;
        avatar_url?: string | null;
      };
      const senderName = senderData.display_name || 'Someone';
      const messageTypeLabels: Record<string, string> = {
        text: 'sent a message',
        voice: 'sent a voice note',
        correction: 'sent a correction',
        doodle: 'sent a doodle',
      };

      const actionLabel = messageTypeLabels[messageType] || 'sent a message';

      await this.notificationsService.sendPushNotification(receiverId, {
        type: 'new_message',
        title: senderName,
        body: `${actionLabel}: ${messagePreview}`,
        data: {
          channel: roomId,
          sender_id: senderId,
          sender_name: senderName,
          sender_avatar: senderData.avatar_url || '',
          room_id: roomId,
        },
      });
    } catch (err) {
      console.error('Chat notification listener error:', err);
    }
  }
}
