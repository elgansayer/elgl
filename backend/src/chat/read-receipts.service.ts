import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Database, SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from './centrifugo.service';

export type DeliveryStatus = 'sent' | 'delivered' | 'read';

export interface ReadReceiptUser {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  readAt: string;
}

export interface MessageReceiptStatus {
  messageId: string;
  deliveryStatus: DeliveryStatus;
  readBy: ReadReceiptUser[];
  totalMembers: number;
}

interface ReceiptMessageRow {
  id: string;
  room_id: string;
  sender_id: string;
  delivery_status?: string | null;
}

interface RoomMemberRow {
  user_id: string;
}

interface MessageReceiptRow {
  user_id: string;
  status: 'delivered' | 'read';
  read_at: string | null;
  user?: {
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

@Injectable()
export class ReadReceiptsService {
  private readonly logger = new Logger(ReadReceiptsService.name);

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

    await this.recordReceipt(messageId, userId, 'delivered');

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

    await this.recordReceipt(messageId, userId, 'read');

    if (msg.delivery_status !== 'read') {
      await supabase
        .from('chat_messages')
        .update({ delivery_status: 'read' })
        .eq('id', messageId);

      await this.publishReceiptUpdate(roomId, messageId, 'read');
    }
  }

  /**
   * Persists a per-recipient receipt without changing the aggregate message
   * status. Callers that already verified room membership use this directly so
   * group receipts can report exactly who has read a message.
   */
  async recordReceipt(
    messageId: string,
    userId: string,
    status: 'delivered' | 'read',
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const values: Database['public']['Tables']['message_receipts']['Insert'] =
      status === 'read'
        ? {
            message_id: messageId,
            user_id: userId,
            status,
            read_at: new Date().toISOString(),
          }
        : {
            message_id: messageId,
            user_id: userId,
            status,
          };

    const { error } = await supabase.from('message_receipts').upsert(values, {
      onConflict: 'message_id,user_id',
      ignoreDuplicates: status === 'delivered',
    });

    if (error) {
      this.logger.warn(
        `Failed to persist ${status} receipt for message ${messageId}`,
      );
    }
  }

  async markAllAsRead(roomId: string, userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // ⚡ Bolt Optimization: Combined `.select('id')` and `.update()` into a single query to eliminate a round trip.
    const { data: updatedMessages } = await supabase
      .from('chat_messages')
      .update({ delivery_status: 'read' })
      .eq('room_id', roomId)
      .neq('sender_id', userId)
      .neq('delivery_status', 'read')
      .select('id');

    if (!updatedMessages || updatedMessages.length === 0) return;

    const messageIds = updatedMessages.map((m: { id: string }) => m.id);
    const readAt = new Date().toISOString();
    const receiptRows: Array<{
      message_id: string;
      user_id: string;
      status: 'read';
      read_at: string;
    }> = messageIds.map((messageId: string) => ({
      message_id: messageId,
      user_id: userId,
      status: 'read',
      read_at: readAt,
    }));

    const { error } = await supabase
      .from('message_receipts')
      .upsert(receiptRows, { onConflict: 'message_id,user_id' });

    if (error) {
      this.logger.warn(
        `Failed to persist bulk read receipts for room ${roomId}`,
      );
    }

    await this.centrifugoService.publish(`chat:${roomId}:receipts`, {
      type: 'bulk_read',
      readBy: userId,
      messageIds,
    });
  }

  async getReceiptStatus(
    messageId: string,
    viewerId?: string,
  ): Promise<MessageReceiptStatus | null> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from('chat_messages')
      .select('id, delivery_status, room_id, sender_id')
      .eq('id', messageId)
      .single();

    const msg: ReceiptMessageRow | null = data;
    if (!msg) return null;

    const { data: memberRows } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', msg.room_id);

    const members: RoomMemberRow[] = memberRows ?? [];

    if (
      viewerId &&
      (viewerId !== msg.sender_id ||
        !members.some((member) => member.user_id === viewerId))
    ) {
      throw new ForbiddenException('Not authorised to view message receipts');
    }

    const { data: receiptRows } = await supabase
      .from('message_receipts')
      .select(
        `
        user_id,
        status,
        read_at,
        user:users!message_receipts_user_id_fkey (
          display_name,
          avatar_url
        )
      `,
      )
      .eq('message_id', messageId);

    const receipts: MessageReceiptRow[] = receiptRows ?? [];
    const recipientIds = new Set(
      members
        .map((member) => member.user_id)
        .filter((userId) => userId !== msg.sender_id),
    );

    const readBy = receipts
      .filter(
        (receipt) =>
          receipt.status === 'read' && recipientIds.has(receipt.user_id),
      )
      .map((receipt) => ({
        userId: receipt.user_id,
        displayName: receipt.user?.display_name ?? '',
        avatarUrl: receipt.user?.avatar_url ?? null,
        readAt: receipt.read_at ?? '',
      }))
      .sort((a, b) => b.readAt.localeCompare(a.readAt));

    const stored: DeliveryStatus =
      msg.delivery_status === 'delivered' || msg.delivery_status === 'read'
        ? msg.delivery_status
        : 'sent';

    let deliveryStatus: DeliveryStatus = stored;
    if (recipientIds.size > 0 && readBy.length >= recipientIds.size) {
      deliveryStatus = 'read';
    } else if (receipts.length > 0 && stored !== 'read') {
      deliveryStatus = 'delivered';
    }

    return {
      messageId: msg.id,
      deliveryStatus,
      readBy,
      totalMembers: recipientIds.size,
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

    // The chat room subscribes to the general room channel for message state,
    // so mirror the aggregate update there for the sender's checkmarks.
    await this.centrifugoService.publish(`chat:${roomId}`, {
      status_update: {
        message_id: messageId,
        delivery_status: newStatus,
      },
    });
  }
}
