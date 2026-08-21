import type { ChatMessage } from '../../services/chat.service';

export type DeliveryStatus = NonNullable<ChatMessage['delivery_status']>;

export interface ChatRoomRealtimeResult {
  messages: ChatMessage[];
  incomingMessageToMarkRead: ChatMessage | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDeliveryStatus(value: unknown): value is DeliveryStatus {
  return value === 'sent' || value === 'delivered' || value === 'read';
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value)) return false;
  return (
    typeof value['id'] === 'string' &&
    value['id'].length > 0 &&
    typeof value['room_id'] === 'string' &&
    value['room_id'].length > 0 &&
    typeof value['sender_id'] === 'string' &&
    value['sender_id'].length > 0 &&
    typeof value['message_type'] === 'string' &&
    typeof value['created_at'] === 'string'
  );
}

/**
 * Applies one untrusted Centrifugo payload to the current room state.
 *
 * The function is intentionally pure so realtime payload validation, duplicate
 * suppression and delivery-status ordering remain independently testable.
 */
export function applyChatRoomRealtimeEvent(
  messages: ChatMessage[],
  payload: unknown,
  roomId: string,
  currentUserId: string | undefined,
): ChatRoomRealtimeResult {
  const unchanged = { messages, incomingMessageToMarkRead: null };
  if (!isRecord(payload)) return unchanged;

  const message = payload['message'];
  if (isChatMessage(message)) {
    if (message.room_id !== roomId) return unchanged;

    const existingIndex = messages.findIndex((candidate) => candidate.id === message.id);
    const nextMessages = [...messages];
    if (existingIndex >= 0) {
      // Message events are also used for server-side edits/corrections. Merge the
      // authoritative payload rather than appending a duplicate bubble.
      nextMessages[existingIndex] = { ...nextMessages[existingIndex], ...message };
    } else {
      nextMessages.push(message);
    }

    return {
      messages: nextMessages,
      incomingMessageToMarkRead:
        currentUserId &&
        message.sender_id !== currentUserId &&
        message.delivery_status !== 'read'
          ? message
          : null,
    };
  }

  const statusUpdate = payload['status_update'];
  if (isRecord(statusUpdate)) {
    const messageId = statusUpdate['message_id'];
    const deliveryStatus = statusUpdate['delivery_status'];
    if (typeof messageId !== 'string' || !isDeliveryStatus(deliveryStatus)) return unchanged;

    let changed = false;
    const nextMessages = messages.map((candidate) => {
      if (candidate.id !== messageId) return candidate;
      if (candidate.delivery_status === deliveryStatus) return candidate;
      changed = true;
      return { ...candidate, delivery_status: deliveryStatus };
    });

    return {
      messages: changed ? nextMessages : messages,
      incomingMessageToMarkRead: null,
    };
  }

  if (payload['type'] === 'message_deleted' && payload['deleted_for'] === 'everyone') {
    const messageId = payload['message_id'];
    if (typeof messageId !== 'string' || !messages.some((message) => message.id === messageId)) {
      return unchanged;
    }
    return {
      messages: messages.filter((message) => message.id !== messageId),
      incomingMessageToMarkRead: null,
    };
  }

  return unchanged;
}
