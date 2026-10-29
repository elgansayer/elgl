import type { Mock } from 'vitest';

// ChatService imports LinkPreviewService, which pulls these browser-oriented
// dependencies into the Vitest module graph even though this suite replaces the
// scraper with a test double.
vi.mock('jsdom', () => ({
  JSDOM: vi.fn().mockImplementation(function () {
    return {
      window: {
        document: { createElement: vi.fn(), createDocumentFragment: vi.fn() },
      },
    };
  }),
}));
vi.mock('dompurify', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    sanitize: vi.fn((value: string) => value),
    setConfig: vi.fn(),
  })),
}));

import { ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';
import type { LinkPreview } from '../link-preview/interfaces/link-preview.interface';
import type { SendMessageDto } from './dto/send-message.dto';

type QueryResult = {
  data: unknown;
  error: { message?: string } | null;
};

/**
 * Minimal chainable Supabase query double. Every builder method returns the
 * query itself, terminal `single`/`maybeSingle` resolve with the result and the
 * query is awaitable so `await supabase.from(...).select().eq()` also works.
 */
function query(result: QueryResult): Record<string, Mock> {
  const stub: Record<string, Mock> = {};
  for (const method of [
    'select',
    'eq',
    'neq',
    'in',
    'insert',
    'update',
    'delete',
    'order',
    'limit',
  ]) {
    stub[method] = vi.fn().mockReturnValue(stub);
  }
  stub.single = vi.fn().mockResolvedValue(result);
  stub.maybeSingle = vi.fn().mockResolvedValue(result);
  stub.then = vi.fn((resolve: (value: QueryResult) => unknown) =>
    resolve(result),
  );
  return stub;
}

const ok = (data: unknown): QueryResult => ({ data, error: null });

const preview: LinkPreview = {
  url: 'https://example.com/post',
  title: 'A post',
  description: 'About a post',
  image: 'https://example.com/cover.png',
  siteName: 'Example',
};

function createService(from: Mock, getPreview: Mock) {
  const centrifugoService = { publish: vi.fn().mockResolvedValue(undefined) };
  const service = new ChatService(
    { getClient: vi.fn().mockReturnValue({ from }) } as never,
    centrifugoService as never,
    undefined,
    { emit: vi.fn() } as never,
    { getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]) } as never,
    { getPreview } as never,
    { isSpam: vi.fn().mockReturnValue(false) } as never,
    { proxyMessage: vi.fn() } as never,
    {} as never,
    { awardXpForActivity: vi.fn().mockResolvedValue(undefined) } as never,
    {} as never,
    { get: vi.fn().mockReturnValue(5) } as never,
    {} as never,
  );
  return { service, centrifugoService };
}

function publishedMessage(centrifugoService: {
  publish: Mock;
}): Record<string, unknown> {
  const [, payload] = centrifugoService.publish.mock.calls[0] as [
    string,
    { message: Record<string, unknown> },
  ];
  return payload.message;
}

describe('ChatService link previews', () => {
  describe('sendMessage', () => {
    const savedMessage = {
      id: 'message-1',
      room_id: 'room-1',
      sender_id: 'sender-1',
      message_type: 'text',
      text_content: 'placeholder',
      media_url: null,
      correction_payload: null,
      delivery_status: 'sent',
      created_at: '2026-10-28T10:00:00.000Z',
    };

    function createSendHarness(getPreview: Mock) {
      // Direct room with no other members: the block/filter checks are skipped.
      const from = vi.fn((table: string) => {
        if (table === 'chat_room_members') return query(ok([]));
        if (table === 'chat_messages') return query(ok(savedMessage));
        throw new Error(`Unexpected table in test: ${table}`);
      });
      return createService(from, getPreview);
    }

    function textDto(text: string): SendMessageDto {
      return { room_id: 'room-1', message_type: 'text', text_content: text };
    }

    it('attaches the preview to the published and returned message', async () => {
      const getPreview = vi.fn().mockResolvedValue(preview);
      const { service, centrifugoService } = createSendHarness(getPreview);

      const result = await service.sendMessage(
        'sender-1',
        textDto('Have a look at https://example.com/post'),
      );

      expect(getPreview).toHaveBeenCalledWith('https://example.com/post');
      expect(publishedMessage(centrifugoService)).toEqual({
        ...savedMessage,
        link_preview: preview,
      });
      expect(result.link_preview).toEqual(preview);
    });

    it('scrapes the link rather than the punctuation that follows it', async () => {
      const getPreview = vi.fn().mockResolvedValue(preview);
      const { service } = createSendHarness(getPreview);

      await service.sendMessage(
        'sender-1',
        textDto('(see https://example.com/post). Thanks!'),
      );
      await service.sendMessage(
        'sender-1',
        textDto('請看https://example.com/post。謝謝'),
      );

      expect(getPreview).toHaveBeenNthCalledWith(1, 'https://example.com/post');
      expect(getPreview).toHaveBeenNthCalledWith(2, 'https://example.com/post');
    });

    it('only previews the first link in a message', async () => {
      const getPreview = vi.fn().mockResolvedValue(preview);
      const { service } = createSendHarness(getPreview);

      await service.sendMessage(
        'sender-1',
        textDto('https://example.com/post and https://other.example/page'),
      );

      expect(getPreview).toHaveBeenCalledTimes(1);
      expect(getPreview).toHaveBeenCalledWith('https://example.com/post');
    });

    it('does not scrape text without a link', async () => {
      const getPreview = vi.fn();
      const { service, centrifugoService } = createSendHarness(getPreview);

      await service.sendMessage('sender-1', textDto('No links here'));

      expect(getPreview).not.toHaveBeenCalled();
      expect(publishedMessage(centrifugoService)).not.toHaveProperty(
        'link_preview',
      );
    });

    it('does not scrape links inside non-text messages', async () => {
      const getPreview = vi.fn().mockResolvedValue(preview);
      const { service } = createSendHarness(getPreview);

      await service.sendMessage('sender-1', {
        room_id: 'room-1',
        message_type: 'correction_request',
        text_content: 'https://example.com/post',
      });

      expect(getPreview).not.toHaveBeenCalled();
    });

    it('delivers the message unchanged when the scraper fails', async () => {
      const getPreview = vi
        .fn()
        .mockRejectedValue(new Error('Unable to fetch preview'));
      const { service, centrifugoService } = createSendHarness(getPreview);

      const result = await service.sendMessage(
        'sender-1',
        textDto('https://example.com/post'),
      );

      expect(centrifugoService.publish).toHaveBeenCalledTimes(1);
      expect(publishedMessage(centrifugoService)).toEqual(savedMessage);
      expect(result).toEqual(savedMessage);
    });

    it('delivers the message unchanged when the page has no metadata', async () => {
      const getPreview = vi.fn().mockResolvedValue(null);
      const { service, centrifugoService } = createSendHarness(getPreview);

      await service.sendMessage(
        'sender-1',
        textDto('https://example.com/bare'),
      );

      expect(publishedMessage(centrifugoService)).toEqual(savedMessage);
    });
  });

  describe('editMessage', () => {
    const roomId = 'room-edit-1';
    const messageId = 'message-edit-1';
    const senderId = 'sender-edit-1';
    const original = {
      id: messageId,
      room_id: roomId,
      sender_id: senderId,
      message_type: 'text',
      text_content: 'Look at https://example.com/old',
      created_at: new Date().toISOString(),
    };

    function updated(text: string) {
      return {
        ...original,
        text_content: text,
        is_edited: true,
        edited_at: '2026-10-28T10:05:00.000Z',
      };
    }

    function createEditHarness(
      getPreview: Mock,
      overrides: { original?: unknown; membership?: unknown } = {},
    ) {
      const fetchOriginal = query(ok(overrides.original ?? original));
      const membership = query(
        ok(
          overrides.membership === undefined
            ? { user_id: senderId }
            : overrides.membership,
        ),
      );
      const update = query(ok(updated('placeholder')));
      const from = vi
        .fn()
        .mockReturnValueOnce(fetchOriginal)
        .mockReturnValueOnce(membership)
        .mockReturnValueOnce(update);
      const harness = createService(from, getPreview);
      return { ...harness, update };
    }

    it('publishes and returns the preview of the edited text', async () => {
      const getPreview = vi.fn().mockResolvedValue(preview);
      const { service, centrifugoService, update } =
        createEditHarness(getPreview);
      update.single.mockResolvedValue(
        ok(updated('Now try https://example.com/post.')),
      );

      const result = await service.editMessage(senderId, messageId, {
        text_content: 'Now try https://example.com/post.',
      });

      expect(getPreview).toHaveBeenCalledWith('https://example.com/post');
      expect(publishedMessage(centrifugoService)).toMatchObject({
        id: messageId,
        is_edited: true,
        link_preview: preview,
      });
      expect(result).toEqual(publishedMessage(centrifugoService));
    });

    it('publishes an explicit null preview when the edit removes the link', async () => {
      const getPreview = vi.fn();
      const { service, centrifugoService, update } =
        createEditHarness(getPreview);
      update.single.mockResolvedValue(ok(updated('No link any more')));

      const result = await service.editMessage(senderId, messageId, {
        text_content: 'No link any more',
      });

      expect(getPreview).not.toHaveBeenCalled();
      // Realtime clients merge edit events over their local copy, so the field
      // must be present and null rather than omitted.
      expect(publishedMessage(centrifugoService)).toHaveProperty(
        'link_preview',
        null,
      );
      expect(result.link_preview).toBeNull();
    });

    it('clears the previous preview when the new link cannot be previewed', async () => {
      const getPreview = vi
        .fn()
        .mockRejectedValue(new Error('Unable to fetch preview'));
      const { service, centrifugoService, update } =
        createEditHarness(getPreview);
      update.single.mockResolvedValue(
        ok(updated('Moved to https://broken.example/page')),
      );

      const result = await service.editMessage(senderId, messageId, {
        text_content: 'Moved to https://broken.example/page',
      });

      expect(publishedMessage(centrifugoService)).toHaveProperty(
        'link_preview',
        null,
      );
      expect(result.text_content).toBe('Moved to https://broken.example/page');
    });

    it('never scrapes for a caller who may not edit the message', async () => {
      const getPreview = vi.fn().mockResolvedValue(preview);
      const { service, centrifugoService } = createEditHarness(getPreview, {
        original: { ...original, sender_id: 'someone-else' },
      });

      await expect(
        service.editMessage(senderId, messageId, {
          text_content: 'Hijack https://example.com/post',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(getPreview).not.toHaveBeenCalled();
      expect(centrifugoService.publish).not.toHaveBeenCalled();
    });

    it('never scrapes for a caller who left the room', async () => {
      const getPreview = vi.fn().mockResolvedValue(preview);
      const { service, centrifugoService } = createEditHarness(getPreview, {
        membership: null,
      });

      await expect(
        service.editMessage(senderId, messageId, {
          text_content: 'Still here https://example.com/post',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(getPreview).not.toHaveBeenCalled();
      expect(centrifugoService.publish).not.toHaveBeenCalled();
    });
  });

  describe('forwardMessage', () => {
    const userId = 'forwarder-1';
    const originalText = 'Worth reading: https://example.com/post.';

    function createForwardHarness(
      getPreview: Mock,
      originalType: 'text' | 'voice' = 'text',
    ) {
      const original = {
        id: 'message-fwd-1',
        room_id: 'room-source',
        sender_id: 'author-1',
        message_type: originalType,
        text_content: originalType === 'text' ? originalText : null,
        media_url: null,
      };
      let inserted = 0;
      const from = vi.fn((table: string) => {
        if (table === 'chat_messages') {
          const call = from.mock.calls.filter(
            ([name]) => name === 'chat_messages',
          ).length;
          if (call === 1) return query(ok(original));
          inserted += 1;
          return query(
            ok({
              id: `forwarded-${inserted}`,
              sender_id: userId,
              message_type: originalType,
              text_content: original.text_content,
              is_forwarded: true,
            }),
          );
        }
        const roomMembers = from.mock.calls.filter(
          ([name]) => name === 'chat_room_members',
        ).length;
        if (roomMembers === 1) return query(ok({ user_id: userId }));
        if (roomMembers === 2) {
          return query(ok([{ room_id: 'room-b' }, { room_id: 'room-c' }]));
        }
        return query(ok([]));
      });
      return createService(from, getPreview);
    }

    it('scrapes the forwarded link once and attaches it in every target room', async () => {
      const getPreview = vi.fn().mockResolvedValue(preview);
      const { service, centrifugoService } = createForwardHarness(getPreview);

      const forwarded = await service.forwardMessage(userId, 'message-fwd-1', [
        'room-b',
        'room-c',
      ]);

      expect(getPreview).toHaveBeenCalledTimes(1);
      expect(getPreview).toHaveBeenCalledWith('https://example.com/post');
      expect(centrifugoService.publish).toHaveBeenCalledTimes(2);
      for (const [, payload] of centrifugoService.publish.mock.calls as [
        string,
        { message: Record<string, unknown> },
      ][]) {
        expect(payload.message).toMatchObject({
          is_forwarded: true,
          link_preview: preview,
        });
      }
      expect(forwarded).toHaveLength(2);
      expect(
        forwarded.every((message) => message.link_preview === preview),
      ).toBe(true);
    });

    it('forwards the message without a preview when the scraper fails', async () => {
      const getPreview = vi.fn().mockRejectedValue(new Error('offline'));
      const { service, centrifugoService } = createForwardHarness(getPreview);

      const forwarded = await service.forwardMessage(userId, 'message-fwd-1', [
        'room-b',
        'room-c',
      ]);

      expect(forwarded).toHaveLength(2);
      for (const [, payload] of centrifugoService.publish.mock.calls as [
        string,
        { message: Record<string, unknown> },
      ][]) {
        expect(payload.message).not.toHaveProperty('link_preview');
      }
    });

    it('does not scrape when forwarding a non-text message', async () => {
      const getPreview = vi.fn().mockResolvedValue(preview);
      const { service } = createForwardHarness(getPreview, 'voice');

      await service.forwardMessage(userId, 'message-fwd-1', ['room-b']);

      expect(getPreview).not.toHaveBeenCalled();
    });
  });
});
