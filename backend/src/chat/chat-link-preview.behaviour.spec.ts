import type { Mock } from 'vitest';

// ChatService imports LinkPreviewService, which pulls these browser-oriented
// dependencies into the Vitest module graph even though this suite mocks the
// scraper and the preview store themselves.
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

import { BadRequestException } from '@nestjs/common';
import { ChatService } from './chat.service';
import type { ChatMessage } from './interfaces/chat-message.interface';
import type { SendMessageDto } from './dto/send-message.dto';

type QueryResult = {
  data?: unknown;
  error?: { message?: string } | null;
  count?: number | null;
};

const CHAIN_METHODS = [
  'select',
  'insert',
  'update',
  'delete',
  'eq',
  'neq',
  'in',
  'not',
  'ilike',
  'order',
  'limit',
  'single',
  'maybeSingle',
] as const;

/** A chainable query builder that resolves to `result` when awaited. */
function query(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  for (const method of CHAIN_METHODS) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) =>
    Promise.resolve({ data: null, error: null, ...result }).then(
      resolve,
      reject,
    );
  return builder;
}

const PREVIEW = {
  url: 'https://example.com/article',
  title: 'Great Article',
  description: 'A description',
  image: 'https://example.com/cover.png',
  siteName: 'Example',
};

describe('ChatService link preview behaviour', () => {
  const callOrder: string[] = [];
  let linkPreviewService: { getPreview: Mock };
  let linkPreviewStore: { save: Mock; remove: Mock; load: Mock };
  let centrifugoService: { publish: Mock };
  let tables: Record<string, QueryResult[]>;
  let service: ChatService;

  const baseMessage = {
    id: 'message-1',
    room_id: 'room-1',
    sender_id: 'sender-1',
    message_type: 'text',
    text_content: 'Hello',
    media_url: null,
    correction_payload: null,
    delivery_status: 'sent',
    is_read: false,
    created_at: '2026-09-25T10:00:00.000Z',
  };

  beforeEach(() => {
    callOrder.length = 0;
    tables = {};
    linkPreviewService = {
      getPreview: vi.fn().mockImplementation(() => {
        callOrder.push('scrape');
        return Promise.resolve(PREVIEW);
      }),
    };
    linkPreviewStore = {
      save: vi.fn().mockImplementation(() => {
        callOrder.push('save');
        return Promise.resolve();
      }),
      remove: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue(new Map()),
    };
    centrifugoService = {
      publish: vi.fn().mockImplementation(() => {
        callOrder.push('publish');
        return Promise.resolve(true);
      }),
    };

    const from = vi.fn((table: string) => {
      const next = tables[table]?.shift();
      if (!next) {
        throw new Error(`Unexpected query on ${table}`);
      }
      if (table === 'chat_messages') {
        callOrder.push(`query:${table}`);
      }
      return query(next);
    });

    service = new ChatService(
      { getClient: vi.fn().mockReturnValue({ from }) } as never,
      centrifugoService as never,
      undefined,
      { emit: vi.fn() } as never,
      {
        getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]),
      } as never,
      linkPreviewService as never,
      { isSpam: vi.fn().mockReturnValue(false) } as never,
      { proxyMessage: vi.fn() } as never,
      {} as never,
      { awardXpForActivity: vi.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      { get: vi.fn().mockReturnValue(5) } as never,
      linkPreviewStore as never,
    );
  });

  describe('sending', () => {
    const send = (text: string, type = 'text') => {
      const dto: SendMessageDto = {
        room_id: 'room-1',
        message_type: type,
        text_content: text,
      };
      tables.chat_room_members = [{ data: [] }];
      tables.chat_messages = [
        { data: { ...baseMessage, message_type: type, text_content: text } },
      ];
      return service.sendMessage('sender-1', dto);
    };

    it('scrapes the first link, keeps the card, and delivers it with the message', async () => {
      const result = await send('Read https://example.com/article now');

      expect(linkPreviewService.getPreview).toHaveBeenCalledWith(
        'https://example.com/article',
        { maxWaitMs: 3_000 },
      );
      expect(linkPreviewStore.save).toHaveBeenCalledWith('message-1', PREVIEW);
      expect(result.link_preview).toEqual(PREVIEW);
      expect(centrifugoService.publish).toHaveBeenCalledWith('chat:room-1', {
        message: expect.objectContaining({
          id: 'message-1',
          link_preview: PREVIEW,
        }),
      });
    });

    it('saves the message before scraping and keeps the card before announcing it', async () => {
      await send('https://example.com/article');

      expect(callOrder).toEqual([
        'query:chat_messages',
        'scrape',
        'save',
        'publish',
      ]);
    });

    it('scrapes the link without the sentence punctuation that follows it', async () => {
      await send('Have you read (https://example.com/article)?');

      expect(linkPreviewService.getPreview).toHaveBeenCalledWith(
        'https://example.com/article',
        expect.anything(),
      );
    });

    it('only scrapes the first of several links', async () => {
      await send('https://a.example/one and https://b.example/two');

      expect(linkPreviewService.getPreview).toHaveBeenCalledTimes(1);
      expect(linkPreviewService.getPreview).toHaveBeenCalledWith(
        'https://a.example/one',
        expect.anything(),
      );
    });

    it('does nothing for messages without a link', async () => {
      const result = await send('Just chatting');

      expect(linkPreviewService.getPreview).not.toHaveBeenCalled();
      expect(linkPreviewStore.save).not.toHaveBeenCalled();
      expect(result.link_preview).toBeUndefined();
    });

    it('does not scrape links in messages that are not plain text', async () => {
      await send('https://example.com/article', 'correction');

      expect(linkPreviewService.getPreview).not.toHaveBeenCalled();
    });

    it.each([
      ['a blocked or broken link', new BadRequestException('nope')],
      ['a link that timed out', new Error('Link preview timed out')],
    ])(
      'still delivers the message when the preview fails for %s',
      async (_label, error) => {
        linkPreviewService.getPreview.mockRejectedValue(error);

        const result = await send('https://example.com/article');

        expect(result.text_content).toBe('https://example.com/article');
        expect(result.link_preview).toBeUndefined();
        expect(linkPreviewStore.save).not.toHaveBeenCalled();
        expect(centrifugoService.publish).toHaveBeenCalledWith('chat:room-1', {
          message: expect.not.objectContaining({
            link_preview: expect.anything(),
          }),
        });
      },
    );

    it('delivers the message plainly when the page exposes no preview', async () => {
      linkPreviewService.getPreview.mockResolvedValue(null);

      const result = await send('https://example.com/article');

      expect(result.link_preview).toBeUndefined();
      expect(linkPreviewStore.save).not.toHaveBeenCalled();
    });

    it('never asks the scraper about private addresses typed into a message', async () => {
      // The scraper rejects these itself; chat still hands over what it found.
      linkPreviewService.getPreview.mockRejectedValue(
        new BadRequestException('Private network URLs are not allowed'),
      );

      const result = await send(
        'Look at http://169.254.169.254/latest/meta-data/',
      );

      expect(result.link_preview).toBeUndefined();
      expect(linkPreviewService.getPreview).toHaveBeenCalledWith(
        'http://169.254.169.254/latest/meta-data/',
        expect.anything(),
      );
    });
  });

  describe('history', () => {
    const rows = [
      {
        ...baseMessage,
        id: 'm1',
        text_content: 'See https://example.com/article',
      },
      { ...baseMessage, id: 'm2', text_content: 'No link' },
      {
        ...baseMessage,
        id: 'm3',
        text_content: 'Hidden https://example.com/hidden',
        deleted_for_user_ids: ['reader-1'],
      },
    ];

    beforeEach(() => {
      tables.chat_room_members = [{ data: [] }];
      tables.chat_messages = [{ data: rows }];
    });

    it('brings back the preview each message was sent with', async () => {
      linkPreviewStore.load.mockResolvedValue(new Map([['m1', PREVIEW]]));

      const messages = await service.getMessages(
        'room-1',
        undefined,
        'reader-1',
      );

      expect(messages.map((message) => message.id)).toEqual(['m1', 'm2']);
      expect(messages[0]?.link_preview).toEqual(PREVIEW);
      expect(messages[1]?.link_preview).toBeUndefined();
    });

    it('only looks up messages the reader can see', async () => {
      await service.getMessages('room-1', undefined, 'reader-1');

      const looked = (linkPreviewStore.load.mock.calls[0]?.[0] ??
        []) as ChatMessage[];
      expect(looked.map((message) => message.id)).toEqual(['m1', 'm2']);
    });

    it('returns the messages untouched when nothing is stored', async () => {
      const messages = await service.getMessages(
        'room-1',
        undefined,
        'reader-1',
      );

      expect(messages[0]).toEqual(rows[0]);
    });

    it('also restores previews for anonymous listings of a room', async () => {
      linkPreviewStore.load.mockResolvedValue(new Map([['m1', PREVIEW]]));
      tables.chat_messages = [{ data: rows }];

      const messages = await service.getMessages('room-1');

      expect(
        messages.find((message) => message.id === 'm1')?.link_preview,
      ).toEqual(PREVIEW);
    });

    it('does not consult the store when the room has no messages to show', async () => {
      tables.chat_messages = [{ data: [] }];

      await service.getMessages('room-1', undefined, 'reader-1');

      expect(linkPreviewStore.load).not.toHaveBeenCalled();
    });
  });

  describe('editing', () => {
    const edit = (original: string, edited: string) => {
      // Edits are only allowed shortly after sending, so the fixture is fresh.
      const createdAt = new Date().toISOString();
      tables.chat_messages = [
        {
          data: {
            ...baseMessage,
            created_at: createdAt,
            text_content: original,
          },
        },
        {
          data: {
            ...baseMessage,
            created_at: createdAt,
            text_content: edited,
            is_edited: true,
          },
        },
      ];
      tables.chat_room_members = [{ data: { user_id: 'sender-1' } }];
      return service.editMessage('sender-1', 'message-1', {
        text_content: edited,
      });
    };

    it('refreshes the card for the edited text and publishes it explicitly', async () => {
      const result = await edit(
        'Old https://example.com/old',
        'New https://example.com/article',
      );

      expect(linkPreviewService.getPreview).toHaveBeenCalledWith(
        'https://example.com/article',
        { maxWaitMs: 3_000 },
      );
      expect(linkPreviewStore.save).toHaveBeenCalledWith('message-1', PREVIEW);
      expect(result.link_preview).toEqual(PREVIEW);
      expect(centrifugoService.publish).toHaveBeenCalledWith('chat:room-1', {
        message: expect.objectContaining({ link_preview: PREVIEW }),
      });
    });

    it('clears the card when the edit removes the link', async () => {
      const result = await edit('Old https://example.com/old', 'No link now');

      expect(linkPreviewStore.remove).toHaveBeenCalledWith('message-1');
      expect(result.link_preview).toBeNull();
      expect(centrifugoService.publish).toHaveBeenCalledWith('chat:room-1', {
        message: expect.objectContaining({ link_preview: null }),
      });
    });

    it('clears the old card when the new link cannot be previewed', async () => {
      linkPreviewService.getPreview.mockRejectedValue(new Error('unreachable'));

      const result = await edit(
        'Old https://example.com/old',
        'New https://example.com/broken',
      );

      expect(linkPreviewStore.remove).toHaveBeenCalledWith('message-1');
      expect(result.link_preview).toBeNull();
      expect(result.text_content).toBe('New https://example.com/broken');
    });

    it('does not touch the store when neither version of the text has a link', async () => {
      const result = await edit('Typo', 'Fixed');

      expect(linkPreviewService.getPreview).not.toHaveBeenCalled();
      expect(linkPreviewStore.save).not.toHaveBeenCalled();
      expect(linkPreviewStore.remove).not.toHaveBeenCalled();
      expect(result.link_preview).toBeNull();
    });
  });

  describe('deleting', () => {
    const remove = (scope: 'self' | 'everyone') => {
      tables.chat_messages = [
        { data: { ...baseMessage, sender_id: 'sender-1' } },
        { error: null },
        { error: null },
      ];
      tables.chat_room_members = [{ data: { user_id: 'sender-1' } }];
      tables.chat_rooms = [{ data: { admin_id: null } }];
      return service.deleteMessage('sender-1', 'message-1', scope);
    };

    it('forgets the preview when the message is deleted for everyone', async () => {
      await remove('everyone');

      expect(linkPreviewStore.remove).toHaveBeenCalledWith('message-1');
    });

    it('keeps the preview when the message is only hidden for one participant', async () => {
      await remove('self');

      expect(linkPreviewStore.remove).not.toHaveBeenCalled();
    });
  });

  describe('forwarding', () => {
    const forward = () => {
      tables.chat_messages = [
        {
          data: {
            ...baseMessage,
            text_content: 'https://example.com/article',
          },
        },
        {
          data: {
            ...baseMessage,
            id: 'forwarded-1',
            room_id: 'room-2',
            is_forwarded: true,
            text_content: 'https://example.com/article',
          },
        },
      ];
      tables.chat_room_members = [
        { data: { user_id: 'sender-1' } },
        { data: [{ room_id: 'room-2' }] },
        { data: [] },
      ];
      return service.forwardMessage('sender-1', 'message-1', ['room-2']);
    };

    it('shows the same card on the forwarded copy without scraping again', async () => {
      linkPreviewStore.load.mockResolvedValue(
        new Map([['message-1', PREVIEW]]),
      );

      const [copy] = await forward();

      expect(linkPreviewService.getPreview).not.toHaveBeenCalled();
      expect(linkPreviewStore.save).toHaveBeenCalledWith(
        'forwarded-1',
        PREVIEW,
      );
      expect(copy?.link_preview).toEqual(PREVIEW);
      expect(centrifugoService.publish).toHaveBeenCalledWith('chat:room-2', {
        message: expect.objectContaining({ link_preview: PREVIEW }),
      });
    });

    it('forwards plainly when the original had no stored preview', async () => {
      const [copy] = await forward();

      expect(linkPreviewStore.save).not.toHaveBeenCalled();
      expect(copy?.link_preview).toBeUndefined();
    });
  });
});
