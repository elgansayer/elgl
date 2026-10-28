import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../services/chat.service';
import {
  applyChatRoomRealtimeEvent,
  effectiveDeliveryStatus,
  mergeMessage,
  prependOlderMessages,
  reconcileLatestWindow,
} from './chat-room-realtime';

const baseMessage: ChatMessage = {
  id: 'message-1',
  room_id: 'room-1',
  sender_id: 'user-1',
  message_type: 'text',
  text_content: 'hello',
  is_read: false,
  delivery_status: 'sent',
  created_at: '2026-08-21T12:00:00.000Z',
};

const systemMessage: ChatMessage = {
  id: 'sys-message-1',
  room_id: 'room-1',
  sender_id: '',
  message_type: 'system',
  system_event: {
    type: 'profileUpdated',
    name: 'Language Partner',
  },
  is_read: false,
  created_at: '2026-08-21T12:01:00.000Z',
};

describe('applyChatRoomRealtimeEvent', () => {
  it('appends an incoming message once and requests a read acknowledgement', () => {
    const result = applyChatRoomRealtimeEvent(
      [],
      { message: baseMessage },
      'room-1',
      'current-user',
    );

    expect(result.messages).toEqual([baseMessage]);
    expect(result.incomingMessageToMarkRead).toEqual(baseMessage);
  });

  it.each(['profileUpdated', 'missedCall'])(
    'accepts the %s system event published by Centrifugo without a sender id',
    (eventType) => {
      const eventMessage: ChatMessage = {
        ...systemMessage,
        id: `sys-${eventType}`,
        system_event: { type: eventType },
      };
      const result = applyChatRoomRealtimeEvent(
        [],
        { message: eventMessage },
        'room-1',
        'current-user',
      );

      expect(result.messages).toEqual([eventMessage]);
      expect(result.incomingMessageToMarkRead).toBeNull();
    },
  );

  it('rejects malformed system events instead of rendering an empty system bubble', () => {
    const result = applyChatRoomRealtimeEvent(
      [],
      {
        message: {
          ...systemMessage,
          system_event: {},
        },
      },
      'room-1',
      'current-user',
    );

    expect(result.messages).toEqual([]);
    expect(result.incomingMessageToMarkRead).toBeNull();
  });

  it('rejects oversized and nested system-event params from realtime payloads', () => {
    const oversized = applyChatRoomRealtimeEvent(
      [],
      {
        message: {
          ...systemMessage,
          system_event: { type: 'announcement', message: 'x'.repeat(501) },
        },
      },
      'room-1',
      'current-user',
    );
    const nested = applyChatRoomRealtimeEvent(
      [],
      {
        message: {
          ...systemMessage,
          system_event: { type: 'announcement', metadata: { unsafe: true } },
        },
      },
      'room-1',
      'current-user',
    );

    expect(oversized.messages).toEqual([]);
    expect(nested.messages).toEqual([]);
  });

  it('rejects invalid system-event type names', () => {
    const result = applyChatRoomRealtimeEvent(
      [],
      {
        message: {
          ...systemMessage,
          system_event: { type: 'system.<script>' },
        },
      },
      'room-1',
      'current-user',
    );

    expect(result.messages).toEqual([]);
  });

  it('merges duplicate message events instead of rendering duplicate bubbles', () => {
    const updated = { ...baseMessage, text_content: 'edited' };
    const result = applyChatRoomRealtimeEvent(
      [baseMessage],
      { message: updated },
      'room-1',
      'current-user',
    );

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.text_content).toBe('edited');
  });

  it('does not acknowledge the current user own messages', () => {
    const result = applyChatRoomRealtimeEvent([], { message: baseMessage }, 'room-1', 'user-1');

    expect(result.incomingMessageToMarkRead).toBeNull();
  });

  it('ignores a valid message published for another room', () => {
    const messages = [baseMessage];
    const result = applyChatRoomRealtimeEvent(
      messages,
      { message: { ...baseMessage, id: 'other', room_id: 'room-2' } },
      'room-1',
      'current-user',
    );

    expect(result.messages).toBe(messages);
    expect(result.incomingMessageToMarkRead).toBeNull();
  });

  it('applies validated delivery-status updates in place', () => {
    const result = applyChatRoomRealtimeEvent(
      [baseMessage],
      { status_update: { message_id: 'message-1', delivery_status: 'read' } },
      'room-1',
      'user-1',
    );

    expect(result.messages[0]?.delivery_status).toBe('read');
    expect(result.messages[0]?.is_read).toBe(true);
  });

  it('never regresses a read receipt when stale realtime status events arrive late', () => {
    const readMessage: ChatMessage = {
      ...baseMessage,
      delivery_status: 'read',
      is_read: true,
    };
    const messages = [readMessage];

    const delivered = applyChatRoomRealtimeEvent(
      messages,
      { status_update: { message_id: 'message-1', delivery_status: 'delivered' } },
      'room-1',
      'user-1',
    );
    const sent = applyChatRoomRealtimeEvent(
      delivered.messages,
      { status_update: { message_id: 'message-1', delivery_status: 'sent' } },
      'room-1',
      'user-1',
    );

    expect(delivered.messages).toBe(messages);
    expect(sent.messages).toBe(messages);
    expect(sent.messages[0]).toMatchObject({ delivery_status: 'read', is_read: true });
  });

  it('treats legacy is_read state as authoritative when status events arrive out of order', () => {
    const legacyRead: ChatMessage = {
      ...baseMessage,
      delivery_status: 'sent',
      is_read: true,
    };
    const messages = [legacyRead];

    const result = applyChatRoomRealtimeEvent(
      messages,
      { status_update: { message_id: 'message-1', delivery_status: 'delivered' } },
      'room-1',
      'user-1',
    );

    expect(result.messages).toBe(messages);
    expect(result.messages[0]?.is_read).toBe(true);
    expect(effectiveDeliveryStatus(result.messages[0]!)).toBe('read');
  });

  it('rejects malformed delivery-status updates', () => {
    const messages = [baseMessage];
    const result = applyChatRoomRealtimeEvent(
      messages,
      { status_update: { message_id: 'message-1', delivery_status: 'hacked' } },
      'room-1',
      'user-1',
    );

    expect(result.messages).toBe(messages);
  });

  it('removes messages only for authoritative delete-for-everyone events', () => {
    const deleted = applyChatRoomRealtimeEvent(
      [baseMessage],
      { type: 'message_deleted', message_id: 'message-1', deleted_for: 'everyone' },
      'room-1',
      'user-1',
    );
    const selfOnly = applyChatRoomRealtimeEvent(
      [baseMessage],
      { type: 'message_deleted', message_id: 'message-1', deleted_for: 'self' },
      'room-1',
      'user-1',
    );

    expect(deleted.messages).toEqual([]);
    expect(selfOnly.messages).toEqual([baseMessage]);
  });

  it('ignores malformed realtime payloads without mutating state', () => {
    const messages = [baseMessage];

    expect(applyChatRoomRealtimeEvent(messages, null, 'room-1', 'user-1').messages).toBe(messages);
    expect(
      applyChatRoomRealtimeEvent(messages, { message: { id: 'partial' } }, 'room-1', 'user-1')
        .messages,
    ).toBe(messages);
    expect(
      applyChatRoomRealtimeEvent(
        messages,
        { message: { ...baseMessage, delivery_status: 'hacked' } },
        'room-1',
        'user-1',
      ).messages,
    ).toBe(messages);
  });
});

describe('mergeMessage', () => {
  it('applies an authoritative edit while keeping the receipt the user already saw', () => {
    const read: ChatMessage = { ...baseMessage, delivery_status: 'read', is_read: true };
    const staleEdit: ChatMessage = {
      ...baseMessage,
      text_content: 'edited',
      delivery_status: 'sent',
      is_read: false,
    };

    const merged = mergeMessage(read, staleEdit);

    expect(merged.text_content).toBe('edited');
    expect(merged.delivery_status).toBe('read');
    expect(merged.is_read).toBe(true);
  });

  it('lets a newer receipt advance the shown one', () => {
    const merged = mergeMessage(
      { ...baseMessage, delivery_status: 'sent' },
      { ...baseMessage, delivery_status: 'delivered' },
    );

    expect(merged.delivery_status).toBe('delivered');
  });

  it('keeps the shown receipt when the incoming copy carries none', () => {
    const merged = mergeMessage(
      { ...baseMessage, delivery_status: 'delivered' },
      { ...baseMessage, delivery_status: undefined },
    );

    expect(merged.delivery_status).toBe('delivered');
  });

  it('normalises a legacy read boolean over the newer sent default', () => {
    const merged = mergeMessage(
      {
        ...baseMessage,
        delivery_status: 'sent',
        is_read: true,
      },
      {
        ...baseMessage,
        delivery_status: 'sent',
        is_read: false,
      },
    );

    expect(merged).toMatchObject({ delivery_status: 'read', is_read: true });
  });
});

describe('applyChatRoomRealtimeEvent receipt monotonicity for message events', () => {
  it('does not downgrade a read receipt when an older message snapshot arrives late', () => {
    const readMessage: ChatMessage = { ...baseMessage, delivery_status: 'read', is_read: true };

    const result = applyChatRoomRealtimeEvent(
      [readMessage],
      { message: { ...baseMessage, delivery_status: 'sent', is_read: false } },
      'room-1',
      'current-user',
    );

    expect(result.messages[0]).toMatchObject({ delivery_status: 'read', is_read: true });
  });
});

describe('reconcileLatestWindow', () => {
  function at(id: string, minute: number, overrides: Partial<ChatMessage> = {}): ChatMessage {
    return {
      ...baseMessage,
      id,
      text_content: id,
      created_at: `2026-08-21T12:${String(minute).padStart(2, '0')}:00.000Z`,
      ...overrides,
    };
  }

  it('adds messages that were missed while disconnected and keeps older history', () => {
    const current = [at('a', 1), at('b', 2)];
    const latest = [at('b', 2), at('c', 3), at('d', 4)];

    const result = reconcileLatestWindow(current, latest, 100);

    expect(result.map((message) => message.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('never takes a receipt back when the fetched copy is older than what is shown', () => {
    const current = [at('a', 1, { delivery_status: 'read', is_read: true })];
    const latest = [at('a', 1, { delivery_status: 'delivered' })];

    const result = reconcileLatestWindow(current, latest, 100);

    expect(result[0]).toMatchObject({ delivery_status: 'read', is_read: true });
  });

  it('advances a receipt that changed while the client was disconnected', () => {
    const current = [at('a', 1, { delivery_status: 'sent' })];
    const latest = [at('a', 1, { delivery_status: 'read', is_read: true })];

    expect(reconcileLatestWindow(current, latest, 100)[0].delivery_status).toBe('read');
  });

  it('drops a persisted message that the server no longer returns inside the window range', () => {
    const current = [at('a', 1), at('deleted', 2), at('c', 3)];
    const latest = [at('a', 1), at('c', 3)];

    const result = reconcileLatestWindow(current, latest, 100);

    expect(result.map((message) => message.id)).toEqual(['a', 'c']);
  });

  it('keeps messages older than the window that the user already loaded', () => {
    const current = [at('old-1', 1), at('old-2', 2), at('c', 5)];
    const latest = [at('c', 5), at('d', 6)];

    const result = reconcileLatestWindow(current, latest, 2);

    expect(result.map((message) => message.id)).toEqual(['old-1', 'old-2', 'c', 'd']);
  });

  it('starts over from the window when a full window shares nothing, because a gap sits between', () => {
    const current = [at('a', 1), at('b', 2)];
    const latest = [at('x', 30), at('y', 31)];

    const result = reconcileLatestWindow(current, latest, 2);

    expect(result.map((message) => message.id)).toEqual(['x', 'y']);
  });

  it('keeps everything the server returned when a short window shows the whole conversation', () => {
    const current = [at('a', 1)];
    const latest = [at('a', 1), at('b', 2)];

    expect(reconcileLatestWindow(current, latest, 100).map((message) => message.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('keeps a live message that was published after the server built the window', () => {
    const current = [at('a', 1), at('b', 2), at('live', 5)];
    const latest = [at('a', 1), at('b', 2)];

    const result = reconcileLatestWindow(current, latest, 100);

    expect(result.map((message) => message.id)).toEqual(['a', 'b', 'live']);
  });

  it('keeps a live message newer than a window that starts over after a gap', () => {
    const current = [at('a', 1), at('live', 40)];
    const latest = [at('x', 30), at('y', 31)];

    const result = reconcileLatestWindow(current, latest, 2);

    expect(result.map((message) => message.id)).toEqual(['x', 'y', 'live']);
  });

  it('keeps realtime-only system events, which the server never returns', () => {
    const systemEvent: ChatMessage = {
      ...systemMessage,
      id: 'sys-1',
      created_at: '2026-08-21T12:02:30.000Z',
    };
    const current = [at('a', 1), systemEvent, at('c', 3)];
    const latest = [at('a', 1), at('c', 3), at('d', 4)];

    const result = reconcileLatestWindow(current, latest, 100);

    expect(result.map((message) => message.id)).toEqual(['a', 'sys-1', 'c', 'd']);
  });

  it('orders by instant even when timestamps use different formats', () => {
    const current = [at('a', 1)];
    const latest = [
      { ...at('a', 1), created_at: '2026-08-21T12:01:00.000000+00:00' },
      { ...at('b', 2), created_at: '2026-08-21T12:02:00.5+00:00' },
    ];
    const systemEvent: ChatMessage = {
      ...systemMessage,
      id: 'sys-2',
      created_at: '2026-08-21T12:02:00.250Z',
    };

    const result = reconcileLatestWindow([...current, systemEvent], latest, 100);

    expect(result.map((message) => message.id)).toEqual(['a', 'sys-2', 'b']);
  });

  it('leaves the current messages untouched when the server returns an empty window', () => {
    const current = [at('a', 1)];

    expect(reconcileLatestWindow(current, [], 100)).toBe(current);
  });
});

describe('prependOlderMessages', () => {
  const shown: ChatMessage = { ...baseMessage, id: 'shown' };
  const older: ChatMessage = { ...baseMessage, id: 'older' };

  it('places older history before the messages already shown', () => {
    expect(prependOlderMessages([shown], [older]).map((message) => message.id)).toEqual([
      'older',
      'shown',
    ]);
  });

  it('ignores messages that are already shown so a retried page cannot duplicate bubbles', () => {
    const current = [shown];

    expect(prependOlderMessages(current, [shown])).toBe(current);
    expect(prependOlderMessages(current, [older, shown]).map((message) => message.id)).toEqual([
      'older',
      'shown',
    ]);
  });
});
