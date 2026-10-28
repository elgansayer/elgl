import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from './centrifugo.service';
import { ChatSettingsService } from './chat-settings.service';

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
  /** Members who read the message and had read receipts enabled at that time. */
  readBy: ReadReceiptUser[];
  /** Number of recipients: every room member except the sender. */
  totalMembers: number;
}

export interface MarkReadResult {
  /** Messages for which a receipt was recorded for this reader. */
  marked: number;
}

interface ReceiptableMessage {
  id: string;
  sender_id: string;
  delivery_status?: string | null;
}

const STATUS_RANK: Record<DeliveryStatus, number> = {
  sent: 0,
  delivered: 1,
  read: 2,
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Upper bound for a single bulk acknowledgement; mirrors MarkRoomReadDto. */
export const MAX_READ_ACK_MESSAGES = 100;
/** Readers returned to the sender. Rooms are small, this is a hard safety cap. */
const MAX_READERS_RETURNED = 100;
/** Keeps every receipts query below PostgREST's default 1000-row response cap. */
const MAX_RECEIPT_ROWS_PER_QUERY = 900;
/** Concurrent Centrifugo publishes per batch when a bulk read promotes many messages. */
const PUBLISH_BATCH_SIZE = 10;

function isDeliveryStatus(value: unknown): value is DeliveryStatus {
  return value === 'sent' || value === 'delivered' || value === 'read';
}

function statusOf(value: string | null | undefined): DeliveryStatus {
  return isDeliveryStatus(value) ? value : 'sent';
}

function isReceiptableMessage(value: unknown): value is ReceiptableMessage {
  if (typeof value !== 'object' || value === null) return false;
  const candidate: Record<string, unknown> = { ...value };
  return (
    typeof candidate['id'] === 'string' &&
    typeof candidate['sender_id'] === 'string' &&
    candidate['sender_id'].length > 0
  );
}

/**
 * Owns read/delivery receipt semantics for chat messages.
 *
 * - `chat_messages.delivery_status` is the sender-facing aggregate: `read` only
 *   once every other room member has read the message.
 * - `message_receipts` stores one row per reader who read the message while
 *   `chat_preferences.readReceipts` was enabled. Readers who keep the setting
 *   off (the default) never disclose reads, so their reads are not stored.
 * - Every status change is published on the room channel as
 *   `{ status_update: { message_id, delivery_status } }`, the contract the
 *   Angular ChatRoomComponent consumes.
 */
@Injectable()
export class ReadReceiptsService {
  private readonly logger = new Logger(ReadReceiptsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly centrifugoService: CentrifugoService,
    private readonly chatSettingsService: ChatSettingsService,
  ) {}

  /**
   * Server-side delivery acknowledgement: the message is stored for the
   * recipient. Idempotent and monotonic, only `sent` can move to `delivered`.
   */
  async markAsDelivered(
    messageId: string,
    roomId: string,
    userId: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: message } = await supabase
      .from('chat_messages')
      .select('delivery_status, sender_id')
      .eq('id', messageId)
      .single();

    if (!message || message.sender_id === userId) return;

    await this.promoteToDelivered(roomId, messageId);
  }

  /**
   * Handles `PATCH /chat/messages/:messageId/status`.
   *
   * Authorisation order matters: the caller must be a member of the message's
   * room before anything else about the message is revealed or changed.
   */
  async updateStatus(
    userId: string,
    messageId: string,
    status: 'delivered' | 'read',
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: message, error } = await supabase
      .from('chat_messages')
      .select('id, room_id, sender_id, delivery_status')
      .eq('id', messageId)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(
        'Receipt update could not be completed',
      );
    }
    if (!message) throw new NotFoundException('Message not found');

    await this.assertMember(message.room_id, userId);

    // A sender can neither acknowledge nor "read" their own message.
    if (message.sender_id === userId) return;

    if (status === 'read') {
      if (!isReceiptableMessage(message)) return;
      await this.recordReads(userId, message.room_id, [message]);
      return;
    }

    if (STATUS_RANK[statusOf(message.delivery_status)] >= STATUS_RANK[status]) {
      return;
    }
    await this.promoteToDelivered(message.room_id, messageId);
  }

  /**
   * Handles `POST /chat/rooms/:roomId/read`: acknowledges many messages with a
   * single request so opening a busy room does not create a request per
   * message. Unknown ids, ids from other rooms and the caller's own messages
   * are ignored rather than rejected.
   */
  async markRead(
    userId: string,
    roomId: string,
    messageIds: readonly string[],
  ): Promise<MarkReadResult> {
    const ids = [...new Set(messageIds)]
      .filter((id) => UUID_PATTERN.test(id))
      .slice(0, MAX_READ_ACK_MESSAGES);

    await this.assertMember(roomId, userId);
    if (ids.length === 0) return { marked: 0 };

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, sender_id, delivery_status')
      .eq('room_id', roomId)
      .in('id', ids)
      .neq('sender_id', userId);

    if (error) {
      throw new ServiceUnavailableException(
        'Read acknowledgement could not be completed',
      );
    }

    const candidates = (data ?? []).filter(isReceiptableMessage);
    return this.recordReads(userId, roomId, candidates);
  }

  /**
   * Returns who has read a message. Only the sender may see this: a reader's
   * identity is disclosed to the author of the message they read, nobody else.
   */
  async getReceiptStatus(
    userId: string,
    messageId: string,
  ): Promise<MessageReceiptStatus> {
    const supabase = this.supabaseService.getClient();
    const { data: message, error } = await supabase
      .from('chat_messages')
      .select('id, room_id, sender_id, delivery_status')
      .eq('id', messageId)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(
        'Receipt status could not be loaded',
      );
    }
    if (!message) throw new NotFoundException('Message not found');

    await this.assertMember(message.room_id, userId);

    if (message.sender_id !== userId) {
      throw new ForbiddenException(
        'Only the sender can view who read a message',
      );
    }

    const { count: recipientCount, error: recipientCountError } = await supabase
      .from('chat_room_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('room_id', message.room_id)
      .neq('user_id', userId);

    if (recipientCountError) {
      throw new ServiceUnavailableException(
        'Receipt status could not be loaded',
      );
    }

    const { data: receipts, error: receiptsError } = await supabase
      .from('message_receipts')
      .select('user_id, read_at')
      .eq('message_id', messageId)
      .eq('status', 'read')
      .order('read_at', { ascending: true })
      .limit(MAX_READERS_RETURNED);

    if (receiptsError) {
      throw new ServiceUnavailableException(
        'Receipt status could not be loaded',
      );
    }

    const receiptRows = (receipts ?? []).filter(
      (row): row is { user_id: string; read_at: string } =>
        typeof row?.user_id === 'string' && typeof row?.read_at === 'string',
    );

    const readBy = await this.describeReaders(receiptRows);

    return {
      messageId: message.id,
      deliveryStatus: statusOf(message.delivery_status),
      readBy,
      totalMembers: recipientCount ?? 0,
    };
  }

  private async describeReaders(
    receipts: { user_id: string; read_at: string }[],
  ): Promise<ReadReceiptUser[]> {
    if (receipts.length === 0) return [];

    const supabase = this.supabaseService.getClient();
    const { data: users, error } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .in(
        'id',
        receipts.map((receipt) => receipt.user_id),
      );

    if (error) {
      throw new ServiceUnavailableException(
        'Receipt status could not be loaded',
      );
    }

    const profiles = new Map<
      string,
      { display_name?: string | null; avatar_url?: string | null }
    >();
    for (const user of users ?? []) {
      if (typeof user?.id === 'string') profiles.set(user.id, user);
    }

    return receipts.map((receipt) => {
      const profile = profiles.get(receipt.user_id);
      return {
        userId: receipt.user_id,
        displayName: profile?.display_name ?? '',
        avatarUrl: profile?.avatar_url ?? null,
        readAt: receipt.read_at,
      };
    });
  }

  private async assertMember(roomId: string, userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: membership, error: membershipError } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (membershipError) {
      throw new ServiceUnavailableException(
        'Room access could not be verified',
      );
    }
    if (membership) return;

    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('id', roomId)
      .maybeSingle();

    if (roomError) {
      throw new ServiceUnavailableException(
        'Room access could not be verified',
      );
    }
    if (!room) throw new NotFoundException('Chat room not found');
    throw new ForbiddenException('Not a member of this room');
  }

  /**
   * Persists this reader's receipts and promotes every message whose other
   * recipients have now all read it. Safe to retry: receipts are inserted with
   * ON CONFLICT DO NOTHING and promotion is a conditional update, so a lost
   * response or a concurrent reader can never double-publish or downgrade.
   */
  private async recordReads(
    userId: string,
    roomId: string,
    messages: ReceiptableMessage[],
  ): Promise<MarkReadResult> {
    const pending = messages.filter((message) => message.sender_id !== userId);
    if (pending.length === 0) return { marked: 0 };

    // Privacy: a reader who has not enabled read receipts never discloses a read.
    const settings = await this.chatSettingsService.getSettings(userId);
    if (!settings.readReceipts) return { marked: 0 };

    const supabase = this.supabaseService.getClient();
    const readAt = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from('message_receipts')
      .upsert(
        pending.map((message) => ({
          message_id: message.id,
          user_id: userId,
          status: 'read',
          read_at: readAt,
        })),
        { onConflict: 'message_id,user_id', ignoreDuplicates: true },
      );

    if (upsertError) {
      throw new Error(`Failed to record read receipts: ${upsertError.message}`);
    }

    const memberIds = await this.loadMemberIds(roomId);
    const readers = await this.loadReaders(
      pending.map((message) => message.id),
      memberIds.length,
    );

    const promotable = pending.filter((message) => {
      if (statusOf(message.delivery_status) === 'read') return false;
      const recipients = memberIds.filter((id) => id !== message.sender_id);
      if (recipients.length === 0) return false;
      const messageReaders = readers.get(message.id);
      return (
        messageReaders !== undefined &&
        recipients.every((id) => messageReaders.has(id))
      );
    });

    if (promotable.length > 0) {
      const { data: updated, error: updateError } = await supabase
        .from('chat_messages')
        .update({ delivery_status: 'read' })
        .in(
          'id',
          promotable.map((message) => message.id),
        )
        .neq('delivery_status', 'read')
        .select('id');

      if (updateError) {
        throw new Error(
          `Failed to update message status: ${updateError.message}`,
        );
      }

      const promotedIds = (updated ?? [])
        .map((row: { id?: unknown }) => row.id)
        .filter((id): id is string => typeof id === 'string');
      await this.publishStatuses(roomId, promotedIds, 'read');
    }

    return { marked: pending.length };
  }

  private async loadMemberIds(roomId: string): Promise<string[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId);

    if (error) {
      throw new Error(`Failed to load room members: ${error.message}`);
    }

    return (data ?? [])
      .map((row: { user_id?: unknown }) => row.user_id)
      .filter((id): id is string => typeof id === 'string');
  }

  /** Reader ids per message, queried in chunks that stay under the row cap. */
  private async loadReaders(
    messageIds: string[],
    memberCount: number,
  ): Promise<Map<string, Set<string>>> {
    const supabase = this.supabaseService.getClient();
    const readers = new Map<string, Set<string>>();
    const chunkSize = Math.max(
      1,
      Math.floor(MAX_RECEIPT_ROWS_PER_QUERY / Math.max(memberCount, 1)),
    );

    for (let start = 0; start < messageIds.length; start += chunkSize) {
      const chunk = messageIds.slice(start, start + chunkSize);
      const { data, error } = await supabase
        .from('message_receipts')
        .select('message_id, user_id')
        .in('message_id', chunk)
        .eq('status', 'read');

      if (error) {
        throw new Error(`Failed to load read receipts: ${error.message}`);
      }

      for (const row of data ?? []) {
        if (
          typeof row?.message_id !== 'string' ||
          typeof row?.user_id !== 'string'
        ) {
          continue;
        }
        const set = readers.get(row.message_id) ?? new Set<string>();
        set.add(row.user_id);
        readers.set(row.message_id, set);
      }
    }

    return readers;
  }

  private async promoteToDelivered(
    roomId: string,
    messageId: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: updated, error } = await supabase
      .from('chat_messages')
      .update({ delivery_status: 'delivered' })
      .eq('id', messageId)
      .eq('delivery_status', 'sent')
      .select('id');

    if (error) {
      throw new Error(`Failed to update message status: ${error.message}`);
    }

    // The conditional update only touches a message that is still `sent`, so a
    // concurrent read can never be downgraded and the event is published once.
    if ((updated ?? []).length > 0) {
      await this.publishStatuses(roomId, [messageId], 'delivered');
    }
  }

  private async publishStatuses(
    roomId: string,
    messageIds: string[],
    status: DeliveryStatus,
  ): Promise<void> {
    for (
      let start = 0;
      start < messageIds.length;
      start += PUBLISH_BATCH_SIZE
    ) {
      const batch = messageIds.slice(start, start + PUBLISH_BATCH_SIZE);
      const results = await Promise.all(
        batch.map((messageId) =>
          this.centrifugoService.publish(`chat:${roomId}`, {
            status_update: { message_id: messageId, delivery_status: status },
          }),
        ),
      );

      // Receipts are already persisted; a lost live event is reconciled by the
      // client on reconnect or reload. Log ids only, never message content.
      results.forEach((published, index) => {
        if (!published) {
          this.logger.warn(
            `Receipt publish failed room=${roomId} message=${batch[index]} status=${status}`,
          );
        }
      });
    }
  }
}
