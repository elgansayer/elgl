import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OfflineQueueService } from './offline-queue.service';
import { ChatMessage } from './chat.service';

function makeChatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    room_id: 'room-1',
    sender_id: 'user-1',
    message_type: 'text',
    text_content: 'hello',
    is_read: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('OfflineQueueService', () => {
  let service: OfflineQueueService;

  beforeEach(() => {
    service = new OfflineQueueService();
  });

  afterEach(async () => {
    await service.clearAll();
  });

  describe('lifecycle', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('enqueueMessage', () => {
    it('stores a message and persists queued_at / retry_count metadata', async () => {
      const msg = makeChatMessage({ id: 'q-1', text_content: 'queued message' });
      await service.enqueueMessage(msg);

      const all = await service.getQueuedMessages();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('q-1');
      expect(all[0].text_content).toBe('queued message');
      expect(all[0].queued_at).toBeTruthy();
      expect(all[0].retry_count).toBe(0);
    });

    it('updates an existing message when re-enqueued with the same id', async () => {
      const msg = makeChatMessage({ id: 'dup-1', text_content: 'first' });
      await service.enqueueMessage(msg);

      const updated = makeChatMessage({ id: 'dup-1', text_content: 'second' });
      await service.enqueueMessage(updated);

      const all = await service.getQueuedMessages();
      expect(all).toHaveLength(1);
      expect(all[0].text_content).toBe('second');
    });

    it('handles voice messages with media_url', async () => {
      const msg = makeChatMessage({
        id: 'voice-1',
        message_type: 'voice',
        media_url: 'https://example.com/audio.webm',
        text_content: undefined,
      });
      await service.enqueueMessage(msg);

      const all = await service.getQueuedMessages();
      expect(all).toHaveLength(1);
      expect(all[0].message_type).toBe('voice');
      expect(all[0].media_url).toBe('https://example.com/audio.webm');
    });

    it('stores correction_payload when present', async () => {
      const msg = makeChatMessage({
        id: 'corr-1',
        message_type: 'correction',
        text_content: 'fixed text',
        correction_payload: {
          original: 'broken text',
          corrected: 'fixed text',
          explanation: 'grammar',
        },
      });
      await service.enqueueMessage(msg);

      const all = await service.getQueuedMessages();
      expect(all).toHaveLength(1);
      expect(all[0].correction_payload?.original).toBe('broken text');
      expect(all[0].correction_payload?.corrected).toBe('fixed text');
    });
  });

  describe('getQueuedMessages', () => {
    it('returns an empty array when no messages are queued', async () => {
      const all = await service.getQueuedMessages();
      expect(all).toEqual([]);
    });

    it('returns multiple messages', async () => {
      await service.enqueueMessage(makeChatMessage({ id: 'a', text_content: 'first' }));
      await service.enqueueMessage(makeChatMessage({ id: 'b', text_content: 'second' }));
      await service.enqueueMessage(makeChatMessage({ id: 'c', text_content: 'third' }));

      const all = await service.getQueuedMessages();
      expect(all).toHaveLength(3);
      expect(all.map((m) => m.id)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('removeMessage', () => {
    it('deletes a queued message by id', async () => {
      await service.enqueueMessage(makeChatMessage({ id: 'to-remove' }));
      await service.enqueueMessage(makeChatMessage({ id: 'keep' }));

      await service.removeMessage('to-remove');

      const all = await service.getQueuedMessages();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('keep');
    });

    it('is a no-op when the id does not exist', async () => {
      await service.removeMessage('non-existent');
      const all = await service.getQueuedMessages();
      expect(all).toEqual([]);
    });
  });

  describe('incrementRetryCount', () => {
    it('increments retry_count for an existing queued message', async () => {
      await service.enqueueMessage(makeChatMessage({ id: 'retry-me' }));

      await service.incrementRetryCount('retry-me');
      await service.incrementRetryCount('retry-me');
      await service.incrementRetryCount('retry-me');

      const all = await service.getQueuedMessages();
      expect(all[0].retry_count).toBe(3);
    });

    it('is a no-op for a non-existent message id', async () => {
      await expect(service.incrementRetryCount('ghost')).resolves.toBeUndefined();
    });
  });

  describe('clearAll', () => {
    it('removes every queued message', async () => {
      await service.enqueueMessage(makeChatMessage({ id: 'c1' }));
      await service.enqueueMessage(makeChatMessage({ id: 'c2' }));

      await service.clearAll();

      const all = await service.getQueuedMessages();
      expect(all).toEqual([]);
    });

    it('is a no-op on an already empty store', async () => {
      await expect(service.clearAll()).resolves.toBeUndefined();
    });
  });
});