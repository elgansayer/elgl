import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../services/chat.service';
import { applyChatRoomRealtimeEvent } from './chat-room-realtime';

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

    expect(applyChatRoomRealtimeEvent(messages, null, 'room-1', 'user-1').messages).toBe(
      messages,
    );
    expect(
      applyChatRoomRealtimeEvent(messages, { message: { id: 'partial' } }, 'room-1', 'user-1')
        .messages,
    ).toBe(messages);
  });
});
