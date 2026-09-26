import type { Mock } from 'vitest';
// The real LinkPreviewService validates stored entries; its browser-oriented
// dependencies are replaced by the same strict tag stripper the service spec uses.
vi.mock('jsdom', () => ({
  JSDOM: vi.fn().mockImplementation(function () {
    return { window: {} };
  }),
}));
vi.mock('dompurify', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    sanitize: (dirty: string) => dirty.replace(/<[^>]*>/g, ''),
    setConfig: vi.fn(),
  })),
}));

import { Logger } from '@nestjs/common';
import { LinkPreviewService } from './link-preview.service';
import {
  MESSAGE_PREVIEW_TTL_SECONDS,
  MessageLinkPreviewStore,
  PreviewableMessage,
} from './message-link-preview.store';

describe('MessageLinkPreviewStore', () => {
  let redis: { set: Mock; del: Mock; mget: Mock; get: Mock };
  let metrics: {
    recordLinkPreviewPersistence: Mock;
    recordLinkPreviewRequest: Mock;
    observeLinkPreviewFetch: Mock;
    setLinkPreviewInflightFetches: Mock;
  };
  let store: MessageLinkPreviewStore;

  const preview = {
    url: 'https://example.com/article',
    title: 'Great Article',
    description: 'A description',
    image: 'https://example.com/cover.png',
    siteName: 'Example',
  };

  const textMessage = (
    id: string,
    text: string,
    type = 'text',
  ): PreviewableMessage => ({
    id,
    message_type: type,
    text_content: text,
  });

  beforeEach(() => {
    redis = {
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      mget: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
    };
    metrics = {
      recordLinkPreviewPersistence: vi.fn(),
      recordLinkPreviewRequest: vi.fn(),
      observeLinkPreviewFetch: vi.fn(),
      setLinkPreviewInflightFetches: vi.fn(),
    };
    const previews = new LinkPreviewService(
      { get: vi.fn() } as never,
      redis as never,
      metrics as never,
    );
    store = new MessageLinkPreviewStore(
      redis as never,
      previews,
      metrics as never,
    );
  });

  afterEach(() => vi.restoreAllMocks());

  describe('save', () => {
    it('keeps the preview under a per-message key for thirty days', async () => {
      await store.save('message-1', preview);

      expect(redis.set).toHaveBeenCalledWith(
        'link_preview:message:v1:message-1',
        JSON.stringify(preview),
        'EX',
        MESSAGE_PREVIEW_TTL_SECONDS,
      );
      expect(MESSAGE_PREVIEW_TTL_SECONDS).toBe(2_592_000);
      expect(metrics.recordLinkPreviewPersistence).toHaveBeenCalledWith(
        'save',
        'ok',
      );
    });

    it('never fails message delivery when Redis is unavailable', async () => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      redis.set.mockRejectedValue(new Error('redis down: token=secret'));

      await expect(store.save('message-1', preview)).resolves.toBeUndefined();

      expect(metrics.recordLinkPreviewPersistence).toHaveBeenCalledWith(
        'save',
        'error',
      );
      expect(String(warn.mock.calls[0]?.[0])).not.toContain('secret');
    });
  });

  describe('remove', () => {
    it('forgets the preview of a deleted message', async () => {
      await store.remove('message-1');

      expect(redis.del).toHaveBeenCalledWith(
        'link_preview:message:v1:message-1',
      );
      expect(metrics.recordLinkPreviewPersistence).toHaveBeenCalledWith(
        'remove',
        'ok',
      );
    });

    it('swallows Redis failures', async () => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      redis.del.mockRejectedValue(new Error('redis down'));

      await expect(store.remove('message-1')).resolves.toBeUndefined();

      expect(metrics.recordLinkPreviewPersistence).toHaveBeenCalledWith(
        'remove',
        'error',
      );
    });
  });

  describe('load', () => {
    it('returns stored previews in one round trip for the messages that still match', async () => {
      redis.mget.mockResolvedValue([
        JSON.stringify(preview),
        null,
        JSON.stringify({ ...preview, url: 'https://example.com/other' }),
      ]);

      const found = await store.load([
        textMessage('m1', 'Read https://example.com/article please'),
        textMessage('m2', 'Read https://example.com/second'),
        textMessage('m3', 'Read https://example.com/other'),
      ]);

      expect(redis.mget).toHaveBeenCalledTimes(1);
      expect(redis.mget).toHaveBeenCalledWith(
        'link_preview:message:v1:m1',
        'link_preview:message:v1:m2',
        'link_preview:message:v1:m3',
      );
      expect([...found.keys()]).toEqual(['m1', 'm3']);
      expect(found.get('m1')).toEqual(preview);
      expect(metrics.recordLinkPreviewPersistence).toHaveBeenCalledWith(
        'load',
        'hit',
        2,
      );
      expect(metrics.recordLinkPreviewPersistence).toHaveBeenCalledWith(
        'load',
        'miss',
        1,
      );
    });

    it('does not ask Redis about messages that cannot carry a preview', async () => {
      const found = await store.load([
        textMessage('m1', 'No link in this message'),
        textMessage('m2', 'https://example.com/voice', 'voice'),
        { id: 'm3', message_type: 'text', text_content: null },
        { id: 'm4', message_type: 'text' },
        textMessage('m5', 'Only ftp://example.com/file here'),
      ]);

      expect(found.size).toBe(0);
      expect(redis.mget).not.toHaveBeenCalled();
    });

    it('matches the link the way the composer wrote it, ignoring sentence punctuation', async () => {
      redis.mget.mockResolvedValue([JSON.stringify(preview)]);

      const found = await store.load([
        textMessage('m1', 'Have you read (https://example.com/article)?'),
      ]);

      expect(found.get('m1')).toEqual(preview);
    });

    it('stops showing a card after an edit changed the first link', async () => {
      redis.mget.mockResolvedValue([JSON.stringify(preview)]);

      const found = await store.load([
        textMessage('m1', 'Edited: https://example.com/a-different-page'),
      ]);

      expect(found.size).toBe(0);
    });

    it('re-validates stored entries because Redis content is untrusted', async () => {
      redis.mget.mockResolvedValue([
        '{not json',
        JSON.stringify({ ...preview, image: 'javascript:alert(1)' }),
        JSON.stringify({ ...preview, image: 'http://10.0.0.1/pixel.png' }),
        JSON.stringify({ ...preview, title: '<b>Bold</b>' }),
        JSON.stringify({ url: preview.url }),
        JSON.stringify([]),
        'x'.repeat(20_000),
      ]);

      const found = await store.load(
        Array.from({ length: 7 }, (_, index) =>
          textMessage(`m${index}`, 'See https://example.com/article'),
        ),
      );

      expect(found.has('m0')).toBe(false);
      expect(found.get('m1')?.image).toBe('');
      expect(found.get('m2')?.image).toBe('');
      expect(found.get('m3')?.title).toBe('Bold');
      expect(found.has('m4')).toBe(false);
      expect(found.has('m5')).toBe(false);
      expect(found.has('m6')).toBe(false);
    });

    it('degrades to plain messages when Redis is unavailable', async () => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      redis.mget.mockRejectedValue(
        new Error('connection refused for https://example.com/article'),
      );

      const found = await store.load([
        textMessage('m1', 'https://example.com/article'),
      ]);

      expect(found.size).toBe(0);
      expect(metrics.recordLinkPreviewPersistence).toHaveBeenCalledWith(
        'load',
        'error',
      );
      expect(String(warn.mock.calls[0]?.[0])).not.toContain('example.com');
    });

    it('bounds how many messages are looked up at once', async () => {
      redis.mget.mockResolvedValue([]);

      await store.load(
        Array.from({ length: 500 }, (_, index) =>
          textMessage(`m${index}`, 'https://example.com/article'),
        ),
      );

      expect(redis.mget.mock.calls[0]).toHaveLength(200);
    });
  });
});
