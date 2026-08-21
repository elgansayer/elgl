import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from './centrifugo.service';

export interface ReadReceiptUser {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  readAt: string;
}

export interface MessageReceiptStatus {
  messageId: string;
  deliveryStatus: 'sent' | 'delivered' | 'read';
  readBy: ReadReceiptUser[];
  totalMembers: number;
}

@Injectable()
export class ReadReceiptsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly centrifugoService: CentrifugoService,
  ) {}

  async markAsDelivered(
    messageId: string,
    roomId: string,
    userId: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: msg } = await supabase
      .from('chat_messages')
      .select('delivery_status, sender_id')
      .eq('id', messageId)
      .single();

    if (!msg || msg.sender_id === userId) return;

    if (msg.delivery_status === 'sent') {
      await supabase
        .from('chat_messages')
        .update({ delivery_status: 'delivered' })
        .eq('id', messageId);

      await this.publishReceiptUpdate(roomId, messageId, 'delivered');
    }
  }

  async markAsRead(
    messageId: string,
    roomId: string,
    userId: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: msg } = await supabase
      .from('chat_messages')
      .select('delivery_status, sender_id')
      .eq('id', messageId)
      .single();

    if (!msg || msg.sender_id === userId) return;

    if (msg.delivery_status !== 'read') {
      await supabase
        .from('chat_messages')
        .update({ delivery_status: 'read' })
        .eq('id', messageId);

      await this.publishReceiptUpdate(roomId, messageId, 'read');
    }
  }

  async markAllAsRead(roomId: string, userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('room_id', roomId)
      .neq('sender_id', userId)
      .neq('delivery_status', 'read');

    if (!messages || messages.length === 0) return;

    const messageIds = messages.map((m: { id: string }) => m.id);

    await supabase
      .from('chat_messages')
      .update({ delivery_status: 'read' })
      .in('id', messageIds);

    await this.centrifugoService.publish(`chat:${roomId}:receipts`, {
      type: 'bulk_read',
      readBy: userId,
      messageIds,
    });
  }

  async getReceiptStatus(
    messageId: string,
  ): Promise<MessageReceiptStatus | null> {
    const supabase = this.supabaseService.getClient();
    const { data: msg } = await supabase
      .from('chat_messages')
      .select('id, delivery_status, room_id')
      .eq('id', messageId)
      .single();

    if (!msg) return null;

    return {
      messageId: msg.id,
      deliveryStatus:
        (msg.delivery_status as 'sent' | 'delivered' | 'read') ?? 'sent',
      readBy: [],
      totalMembers: 0,
    };
  }

  async setInitialSent(messageId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    await supabase
      .from('chat_messages')
      .update({ delivery_status: 'sent' })
      .eq('id', messageId);
  }

  private async publishReceiptUpdate(
    roomId: string,
    messageId: string,
    newStatus: string,
  ): Promise<void> {
    await this.centrifugoService.publish(`chat:${roomId}:receipts`, {
      type: 'receipt_update',
      messageId,
      deliveryStatus: newStatus,
    });
  }
}
