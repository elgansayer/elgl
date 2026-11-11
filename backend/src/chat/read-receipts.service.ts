import { Injectable, Logger } from '@nestjs/common';
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

type DeliveryStatus = 'sent' | 'delivered' | 'read';
type ReceiptStatus = 'delivered' | 'read';

interface MessageRow {
  id: string;
  room_id: string;
  sender_id: string;
  delivery_status: string | null;
}

interface ReceiptRow {
  user_id: string;
  status: string;
  read_at: string | null;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

const STATUS_RANK: Record<DeliveryStatus, number> = {
  sent: 0,
  delivered: 1,
  read: 2,
};

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
    await this.updateMessageStatus(messageId, roomId, userId, 'delivered');
  }

  async markAsRead(
    messageId: string,
    roomId: string,
    userId: string,
  ): Promise<void> {
    await this.updateMessageStatus(messageId, roomId, userId, 'read');
  }

  /**
   * Records the caller's receipt for a message and only upgrades the
   * message-level delivery status once every other room member has reached it.
   * Repeated calls are idempotent and never downgrade an existing receipt.
   */
  async updateMessageStatus(
    messageId: string,
    roomId: string,
    userId: string,
    status: ReceiptStatus,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { data: message } = await supabase
      .from('chat_messages')
      .select('id, room_id, sender_id, delivery_status')
      .eq('id', messageId)
      .single<MessageRow>();

    // The sender never owns a delivery/read receipt for their own message.
    if (!message || message.sender_id === userId) return;

    const { data: existing } = await supabase
      .from('message_receipts')
      .select('status')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .maybeSingle<{ status: string }>();

    if (
      existing &&
      STATUS_RANK[status] <= STATUS_RANK[existing.status as DeliveryStatus]
    ) {
      return;
    }

    const { error } = await supabase.from('message_receipts').upsert(
      {
        message_id: messageId,
        user_id: userId,
        status,
        read_at: status === 'read' ? new Date().toISOString() : null,
      },
      { onConflict: 'message_id,user_id' },
    );

    if (error) {
      this.logger.error('chat.receipt_persist_failed', {
        messageId,
        userId,
        status,
        reason: error.message,
      });
      return;
    }

    await this.recalculateStatus(
      messageId,
      message.room_id ?? roomId,
      message.sender_id,
      message.delivery_status,
    );
  }

  async markAllAsRead(roomId: string, userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { data: updatedMessages } = await supabase
      .from('chat_messages')
      .update({ delivery_status: 'read' })
      .eq('room_id', roomId)
      .neq('sender_id', userId)
      .neq('delivery_status', 'read')
      .select('id');

    if (!updatedMessages || updatedMessages.length === 0) return;

    const messageIds = updatedMessages.map((m: { id: string }) => m.id);

    const { error } = await supabase.from('message_receipts').upsert(
      messageIds.map((messageId: string) => ({
        message_id: messageId,
        user_id: userId,
        status: 'read',
        read_at: new Date().toISOString(),
      })),
      { onConflict: 'message_id,user_id' },
    );

    if (error) {
      this.logger.error('chat.receipt_bulk_persist_failed', {
        roomId,
        userId,
        reason: error.message,
      });
    }

    await this.centrifugoService.publish(`chat:${roomId}:receipts`, {
      type: 'bulk_read',
      readBy: userId,
      messageIds,
    });
  }

  async getReceiptStatus(
    messageId: string,
    requesterId?: string,
  ): Promise<MessageReceiptStatus | null> {
    const supabase = this.supabaseService.getClient();

    const { data: message } = await supabase
      .from('chat_messages')
      .select('id, room_id, sender_id, delivery_status')
      .eq('id', messageId)
      .single<MessageRow>();

    if (!message) return null;

    if (requesterId) {
      const { data: membership } = await supabase
        .from('chat_room_members')
        .select('user_id')
        .eq('room_id', message.room_id)
        .eq('user_id', requesterId)
        .maybeSingle<{ user_id: string }>();

      if (!membership) return null;
    }

    const { data: receipts } = await supabase
      .from('message_receipts')
      .select('user_id, status, read_at')
      .eq('message_id', messageId)
      .eq('status', 'read')
      .order('read_at', { ascending: true });

    const readRows = (receipts ?? []) as ReceiptRow[];
    const readerIds = readRows.map((row) => row.user_id);

    let profiles: ProfileRow[] = [];
    if (readerIds.length > 0) {
      const { data: userRows } = await supabase
        .from('users')
        .select('id, display_name, avatar_url')
        .in('id', readerIds);
      profiles = (userRows ?? []) as ProfileRow[];
    }

    const profilesById = new Map(
      profiles.map((profile) => [profile.id, profile]),
    );
    const readBy: ReadReceiptUser[] = readRows.map((row) => {
      const profile = profilesById.get(row.user_id);
      return {
        userId: row.user_id,
        displayName: profile?.display_name ?? '',
        avatarUrl: profile?.avatar_url ?? null,
        readAt: row.read_at ?? '',
      };
    });

    const { count } = await supabase
      .from('chat_room_members')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', message.room_id)
      .neq('user_id', message.sender_id);

    return {
      messageId: message.id,
      deliveryStatus: (message.delivery_status ?? 'sent') as DeliveryStatus,
      readBy,
      totalMembers: count ?? 0,
    };
  }

  async setInitialSent(messageId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    await supabase
      .from('chat_messages')
      .update({ delivery_status: 'sent' })
      .eq('id', messageId);
  }

  private async recalculateStatus(
    messageId: string,
    roomId: string,
    senderId: string,
    currentStatus: string | null,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const [receiptsResult, recipientsResult] = await Promise.all([
      supabase
        .from('message_receipts')
        .select('status')
        .eq('message_id', messageId),
      supabase
        .from('chat_room_members')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .neq('user_id', senderId),
    ]);

    const receipts = (receiptsResult.data ?? []) as Array<{ status: string }>;
    const totalRecipients = recipientsResult.count ?? 0;

    let deliveredCount = 0;
    let readCount = 0;
    for (const receipt of receipts) {
      if (receipt.status === 'delivered') deliveredCount += 1;
      if (receipt.status === 'read') {
        deliveredCount += 1;
        readCount += 1;
      }
    }

    const nextStatus: DeliveryStatus =
      totalRecipients > 0 && readCount >= totalRecipients
        ? 'read'
        : deliveredCount > 0
          ? 'delivered'
          : 'sent';

    const current = (currentStatus ?? 'sent') as DeliveryStatus;
    if (STATUS_RANK[nextStatus] <= STATUS_RANK[current]) return;

    const { error } = await supabase
      .from('chat_messages')
      .update({ delivery_status: nextStatus })
      .eq('id', messageId);

    if (error) {
      this.logger.error('chat.receipt_status_update_failed', {
        messageId,
        roomId,
        reason: error.message,
      });
      return;
    }

    await this.publishReceiptUpdate(roomId, messageId, nextStatus);
  }

  private async publishReceiptUpdate(
    roomId: string,
    messageId: string,
    newStatus: DeliveryStatus,
  ): Promise<void> {
    await this.centrifugoService.publish(`chat:${roomId}`, {
      status_update: {
        message_id: messageId,
        delivery_status: newStatus,
      },
    });

    await this.centrifugoService.publish(`chat:${roomId}:receipts`, {
      type: 'receipt_update',
      messageId,
      deliveryStatus: newStatus,
    });
  }
}
