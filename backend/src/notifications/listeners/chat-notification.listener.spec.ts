import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatMessageEvent } from '../events/notification.events';
import { ChatNotificationListener } from './chat-notification.listener';

describe('ChatNotificationListener', () => {
  const createNotification = vi.fn();
  const sendPushNotification = vi.fn();
  const shouldSendNotification = vi.fn();
  const emit = vi.fn();
  let listener: ChatNotificationListener;

  beforeEach(() => {
    vi.clearAllMocks();
    createNotification.mockResolvedValue(undefined);
    sendPushNotification.mockResolvedValue('sent');
    shouldSendNotification.mockResolvedValue(true);
    listener = new ChatNotificationListener(
      { createNotification, sendPushNotification } as never,
      { shouldSendNotification } as never,
      { emit } as never,
    );
  });

  it('invalidates the personal chat count for a persisted incoming message', async () => {
    await listener.handleChatMessage(
      new ChatMessageEvent(
        'sender-1',
        'recipient-1',
        'room-1',
        'text',
        'Hello',
      ),
    );

    expect(emit).toHaveBeenCalledWith(
      'unread.counts_changed',
      expect.objectContaining({
        recipientId: 'recipient-1',
        source: 'chat',
      }),
    );
  });

  it('does not invalidate unread state for a self-addressed event', async () => {
    await listener.handleChatMessage(
      new ChatMessageEvent('user-1', 'user-1', 'room-1', 'text', 'Hello'),
    );

    expect(emit).not.toHaveBeenCalled();
  });
});
