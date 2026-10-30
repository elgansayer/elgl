// Behaviour of link-preview persistence in ChatService: the resolved preview is
// stored with its message so history, search and export return it, and the
// stored value is revalidated against the message text on every read. The real
// LinkPreviewService (with the real cheerio, DOMPurify and JSDOM) is used for
// the read path so the revalidation is exercised rather than assumed; only its
// scraper entry point is replaced.
import type { Mock } from 'vitest';
import type { HttpService } from '@nestjs/axios';
import type Redis from 'ioredis';
import { ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { LinkPreviewService } from '../link-preview/link-preview.service';
import type { MetricsService } from '../metrics/metrics.service';
import type { LinkPreview } from '../link-preview/interfaces/link-preview.interface';
import type { SendMessageDto } from './dto/send-message.dto';

type QueryResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};
type Stub = Record<string, Mock>;

/**
 * Chainable Supabase query double. Builder methods return the query itself,
 * `single`/`maybeSingle` resolve with the result and the query is awaitable.
 * Passing an Error makes every terminal operation reject instead.
 */
function query(result: QueryResult | Error): Stub {
  const stub: Stub = {};
  for (const method of [
    'select',
    'eq',
    'neq',
    'in',
    'not',
    'ilike',
    'insert',
    'update',
    'delete',
    'order',
    'limit',
  ]) {
    stub[method] = vi.fn().mockReturnValue(stub);
  }
  if (result instanceof Error) {
    stub.single = vi.fn().mockRejectedValue(result);
    stub.maybeSingle = vi.fn().mockRejectedValue(result);
    stub.then = vi.fn(
      (_resolve: (value: QueryResult) => unknown, reject: (e: Error) => void) =>
        reject(result),
    );
  } else {
    stub.single = vi.fn().mockResolvedValue(result);
    stub.maybeSingle = vi.fn().mockResolvedValue(result);
    stub.then = vi.fn((resolve: (value: QueryResult) => unknown) =>
      resolve(result),
    );
  }
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

function createService(from: Mock) {
  const linkPreviews = new LinkPreviewService(
    { get: vi.fn() } as unknown as HttpService,
    { get: vi.fn(), set: vi.fn() } as unknown as Redis,
    { recordLinkPreview: vi.fn() } as unknown as MetricsService,
  );
  const getPreview = vi.spyOn(linkPreviews, 'getPreview');
  const centrifugo = { publish: vi.fn().mockResolvedValue(undefined) };
  const service = new ChatService(
    { getClient: vi.fn().mockReturnValue({ from }) } as never,
    centrifugo as never,
    undefined,
    { emit: vi.fn() } as never,
    { getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]) } as never,
    linkPreviews,
    { isSpam: vi.fn().mockReturnValue(false) } as never,
    { proxyMessage: vi.fn() } as never,
    {} as never,
    { awardXpForActivity: vi.fn().mockResolvedValue(undefined) } as never,
    {} as never,
    { get: vi.fn().mockReturnValue(5) } as never,
    {} as never,
  );
  return { service, linkPreviews, getPreview, centrifugo };
}

/** The payload and target id of every `update(...).eq('id', id)` write. */
function writesTo(stubs: Stub[]): { payload: unknown; id: unknown }[] {
  return stubs
    .filter((stub) => stub.update.mock.calls.length > 0)
    .map((stub) => ({
      payload: stub.update.mock.calls[0][0] as unknown,
      id: stub.eq.mock.calls.find(
        ([column]) => column === 'id',
      )?.[1] as unknown,
    }));
}

/**
 * Makes awaiting the query pend until `release()` is called, so a test can
 * prove what has and has not happened while a write is still in flight.
 */
function gated(stub: Stub): { release: () => void } {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  stub.then.mockImplementation((resolve: (value: QueryResult) => unknown) => {
    void gate.then(() => resolve(ok(null)));
  });
  return { release };
}

/** Lets every continuation that can already run, run. */
const settle = (): Promise<void> =>
  new Promise<void>((resolve) => setImmediate(resolve));

describe('ChatService link preview persistence', () => {
  let warn: Mock;

  beforeEach(() => {
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {
      /* silence */
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendMessage', () => {
    const savedMessage = {
      id: 'message-1',
      room_id: 'room-1',
      sender_id: 'sender-1',
      message_type: 'text',
      text_content: 'placeholder',
      correction_payload: null,
      delivery_status: 'sent',
      created_at: '2026-10-29T10:00:00.000Z',
    };

    function textDto(text: string): SendMessageDto {
      return { room_id: 'room-1', message_type: 'text', text_content: text };
    }

    function createSendHarness(persist: Stub = query(ok(null))) {
      const insert = query(ok(savedMessage));
      const messages = [insert, persist];
      const from = vi.fn((table: string) => {
        if (table === 'chat_room_members') return query(ok([]));
        if (table === 'chat_messages') {
          return messages.shift() ?? query(ok(null));
        }
        throw new Error(`Unexpected table in test: ${table}`);
      });
      return { ...createService(from), from, insert, persist };
    }

    it('stores the preview on the saved message', async () => {
      const { service, getPreview, persist } = createSendHarness();
      getPreview.mockResolvedValue(preview);

      const result = await service.sendMessage(
        'sender-1',
        textDto('Read https://example.com/post'),
      );

      expect(persist.update).toHaveBeenCalledWith({ link_preview: preview });
      expect(persist.eq).toHaveBeenCalledWith('id', 'message-1');
      expect(result.link_preview).toEqual(preview);
    });

    it('publishes only once the preview is stored', async () => {
      const { service, getPreview, centrifugo, persist } = createSendHarness();
      getPreview.mockResolvedValue(preview);
      const write = gated(persist);

      const sending = service.sendMessage(
        'sender-1',
        textDto('Read https://example.com/post'),
      );
      await settle();

      // What a client sees live must already be in the history it loads later.
      expect(persist.update).toHaveBeenCalled();
      expect(centrifugo.publish).not.toHaveBeenCalled();

      write.release();
      await sending;
      expect(centrifugo.publish).toHaveBeenCalledTimes(1);
    });

    it('does not write when the message has no previewable link', async () => {
      const { service, getPreview, from, persist } = createSendHarness();

      await service.sendMessage('sender-1', textDto('No links here'));

      expect(getPreview).not.toHaveBeenCalled();
      expect(persist.update).not.toHaveBeenCalled();
      expect(
        from.mock.calls.filter(([table]) => table === 'chat_messages'),
      ).toHaveLength(1);
    });

    it('does not write when the scraper fails or finds nothing', async () => {
      for (const outcome of [
        () => Promise.reject(new Error('Unable to fetch preview')),
        () => Promise.resolve(null),
      ]) {
        const { service, getPreview, persist } = createSendHarness();
        getPreview.mockImplementation(outcome);

        await service.sendMessage(
          'sender-1',
          textDto('https://example.com/post'),
        );

        expect(persist.update).not.toHaveBeenCalled();
      }
    });

    it('does not write for non-text messages', async () => {
      const { service, getPreview, persist } = createSendHarness();

      await service.sendMessage('sender-1', {
        room_id: 'room-1',
        message_type: 'correction_request',
        text_content: 'https://example.com/post',
      });

      expect(getPreview).not.toHaveBeenCalled();
      expect(persist.update).not.toHaveBeenCalled();
    });

    it('still delivers the message when the database rejects the write', async () => {
      const { service, getPreview, centrifugo } = createSendHarness(
        query({
          data: null,
          error: {
            code: '42703',
            message: 'column "link_preview" does not exist',
          },
        }),
      );
      getPreview.mockResolvedValue(preview);

      const result = await service.sendMessage(
        'sender-1',
        textDto('https://example.com/post'),
      );

      // The live event still carries the card; only history is missing it.
      expect(centrifugo.publish).toHaveBeenCalledTimes(1);
      expect(result.link_preview).toEqual(preview);
      expect(warn).toHaveBeenCalledWith(
        'chat.link_preview_persist_failed message=message-1 code=42703',
      );
    });

    it('still delivers the message when the write throws', async () => {
      const { service, getPreview, centrifugo } = createSendHarness(
        query(new Error('socket hang up for https://example.com/post')),
      );
      getPreview.mockResolvedValue(preview);

      const result = await service.sendMessage(
        'sender-1',
        textDto('https://example.com/post'),
      );

      expect(centrifugo.publish).toHaveBeenCalledTimes(1);
      expect(result.link_preview).toEqual(preview);
      expect(warn).toHaveBeenCalledWith(
        'chat.link_preview_persist_failed message=message-1',
      );
    });

    it('logs write failures without the link, title or database error text', async () => {
      const { service, getPreview } = createSendHarness(
        query({
          data: null,
          error: { code: '23514', message: `bad row ${preview.url}` },
        }),
      );
      getPreview.mockResolvedValue(preview);

      await service.sendMessage('sender-1', textDto(preview.url));

      const logged = JSON.stringify(warn.mock.calls);
      expect(logged).not.toContain('example.com');
      expect(logged).not.toContain('A post');
      expect(logged).not.toContain('bad row');
    });

    it('never stores a preview supplied by the client', async () => {
      const { service, getPreview, insert } = createSendHarness();
      getPreview.mockResolvedValue(null);

      await service.sendMessage('sender-1', {
        ...textDto('https://example.com/post'),
        link_preview: { ...preview, title: 'Forged' },
      } as SendMessageDto);

      const [inserted] = insert.insert.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(inserted).not.toHaveProperty('link_preview');
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

    function updated(text: string, link_preview: LinkPreview | null = null) {
      return {
        ...original,
        text_content: text,
        link_preview,
        is_edited: true,
        edited_at: '2026-10-29T10:05:00.000Z',
      };
    }

    function createEditHarness(editedRow: ReturnType<typeof updated>) {
      const update = query(ok(editedRow));
      const from = vi
        .fn()
        .mockReturnValueOnce(query(ok(original)))
        .mockReturnValueOnce(query(ok({ user_id: senderId })))
        .mockReturnValueOnce(update);
      return { ...createService(from), from, update };
    }

    it('stores the preview of the edited text', async () => {
      const { service, getPreview, update, centrifugo } = createEditHarness(
        updated('Now try https://example.com/post'),
      );
      getPreview.mockResolvedValue(preview);

      await service.editMessage(senderId, messageId, {
        text_content: 'Now try https://example.com/post',
      });

      expect(update.update).toHaveBeenCalledWith(
        expect.objectContaining({
          text_content: 'Now try https://example.com/post',
          link_preview: preview,
        }),
      );
      expect(update.eq).toHaveBeenCalledWith('id', messageId);
      expect(update.eq).toHaveBeenCalledWith(
        'text_content',
        original.text_content,
      );
      expect(centrifugo.publish).toHaveBeenCalledTimes(1);
    });

    it('clears the stored preview when the edit removes the link', async () => {
      const { service, update, centrifugo } = createEditHarness(
        updated('No link any more', preview),
      );

      const result = await service.editMessage(senderId, messageId, {
        text_content: 'No link any more',
      });

      expect(update.update).toHaveBeenCalledWith(
        expect.objectContaining({ link_preview: null }),
      );
      expect(result.link_preview).toBeNull();
      expect(centrifugo.publish).toHaveBeenCalledTimes(1);
    });

    it('clears the stored preview when the new link cannot be previewed', async () => {
      const { service, getPreview, update } = createEditHarness(
        updated('Moved to https://broken.example/page', preview),
      );
      getPreview.mockRejectedValue(new Error('Unable to fetch preview'));

      await service.editMessage(senderId, messageId, {
        text_content: 'Moved to https://broken.example/page',
      });

      expect(update.update).toHaveBeenCalledWith(
        expect.objectContaining({ link_preview: null }),
      );
    });

    it('atomically stores null when the message has no preview', async () => {
      const { service, from, update } = createEditHarness(
        updated('Still no link'),
      );

      await service.editMessage(senderId, messageId, {
        text_content: 'Still no link',
      });

      expect(update.update).toHaveBeenCalledWith(
        expect.objectContaining({
          text_content: 'Still no link',
          link_preview: null,
        }),
      );
      expect(from).toHaveBeenCalledTimes(3);
    });

    it('suppresses a slower overlapping edit after a newer edit wins', async () => {
      let releaseSlowPreview!: (value: LinkPreview | null) => void;
      const slowPreview = new Promise<LinkPreview | null>((resolve) => {
        releaseSlowPreview = resolve;
      });
      const winningText = 'New https://example.com/post';
      const staleText = 'Slow https://stale.example/page';
      const staleUpdate = query({
        data: null,
        error: { code: 'PGRST116', message: 'No rows' },
      });
      const winningUpdate = query(ok(updated(winningText, preview)));
      const from = vi
        .fn()
        .mockReturnValueOnce(query(ok(original)))
        .mockReturnValueOnce(query(ok({ user_id: senderId })))
        .mockReturnValueOnce(query(ok(original)))
        .mockReturnValueOnce(query(ok({ user_id: senderId })))
        .mockReturnValueOnce(winningUpdate)
        .mockReturnValueOnce(staleUpdate);
      const { service, getPreview, centrifugo } = createService(from);
      getPreview.mockImplementation((url: string) =>
        url.includes('stale.example') ? slowPreview : Promise.resolve(preview),
      );

      const staleEdit = service.editMessage(senderId, messageId, {
        text_content: staleText,
      });
      await settle();
      const winningEdit = service.editMessage(senderId, messageId, {
        text_content: winningText,
      });

      await expect(winningEdit).resolves.toMatchObject({
        text_content: winningText,
        link_preview: preview,
      });
      releaseSlowPreview({ ...preview, url: 'https://stale.example/page' });
      await expect(staleEdit).rejects.toBeInstanceOf(ConflictException);

      expect(staleUpdate.update).toHaveBeenCalledWith(
        expect.objectContaining({ text_content: staleText }),
      );
      expect(centrifugo.publish).toHaveBeenCalledTimes(1);
      expect(centrifugo.publish).toHaveBeenCalledWith(`chat:${roomId}`, {
        message: expect.objectContaining({ text_content: winningText }),
      });
    });

    it('writes nothing for a caller who may not edit the message', async () => {
      const from = vi
        .fn()
        .mockReturnValueOnce(
          query(ok({ ...original, sender_id: 'someone-else' })),
        );
      const { service, getPreview } = createService(from);
      getPreview.mockResolvedValue(preview);

      await expect(
        service.editMessage(senderId, messageId, {
          text_content: 'Hijack https://example.com/post',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(from).toHaveBeenCalledTimes(1);
    });
  });

  describe('fixMessage', () => {
    const fixerId = 'fixer-1';
    const messageId = 'message-fix-1';
    const original = {
      id: messageId,
      room_id: 'room-fix-1',
      sender_id: 'author-1',
      message_type: 'text',
      text_content: 'See https://example.com/post pls',
      correction_payload: null,
    };

    function fixedRow(text: string, link_preview?: LinkPreview) {
      return {
        ...original,
        text_content: text,
        correction_payload: {
          original: original.text_content,
          corrected: text,
        },
        ...(link_preview ? { link_preview } : {}),
      };
    }

    function createFixHarness(
      row: ReturnType<typeof fixedRow>,
      persist: Stub = query(ok(null)),
    ) {
      const from = vi
        .fn()
        .mockReturnValueOnce(query(ok(original)))
        .mockReturnValueOnce(query(ok({ user_id: fixerId })))
        .mockReturnValueOnce(query(ok(row)))
        .mockReturnValueOnce(persist);
      return { ...createService(from), from, persist };
    }

    function fix(service: ChatService, text: string) {
      return service.fixMessage(fixerId, messageId, text, 'Added a word');
    }

    it('leaves a message without a stored preview exactly as before', async () => {
      const row = fixedRow('See https://example.com/post please');
      const { service, getPreview, from, centrifugo } = createFixHarness(row);

      const result = await fix(service, row.text_content);

      expect(result).toEqual(row);
      expect(result).not.toHaveProperty('link_preview');
      expect(centrifugo.publish).toHaveBeenCalledWith('chat:room-fix-1', {
        message: row,
      });
      // No scrape and no write: only the three reads and the text update ran.
      expect(getPreview).not.toHaveBeenCalled();
      expect(from).toHaveBeenCalledTimes(3);
    });

    it('keeps a stored preview that still describes the first link', async () => {
      const row = fixedRow('See https://example.com/post please', preview);
      const { service, getPreview, persist, centrifugo } =
        createFixHarness(row);

      const result = await fix(service, row.text_content);

      expect(result.link_preview).toEqual(preview);
      expect(persist.update).not.toHaveBeenCalled();
      expect(getPreview).not.toHaveBeenCalled();
      expect(centrifugo.publish).toHaveBeenCalledWith('chat:room-fix-1', {
        message: { ...row, link_preview: preview },
      });
    });

    it('clears a stored preview when the fix changes the first link', async () => {
      const row = fixedRow('See https://other.test/page please', preview);
      const { service, persist, centrifugo } = createFixHarness(row);

      const result = await fix(service, row.text_content);

      expect(persist.update).toHaveBeenCalledWith({ link_preview: null });
      expect(persist.eq).toHaveBeenCalledWith('id', messageId);
      // Realtime clients merge the event over their copy, so null clears it.
      expect(result.link_preview).toBeNull();
      expect(centrifugo.publish).toHaveBeenCalledWith('chat:room-fix-1', {
        message: { ...row, link_preview: null },
      });
    });

    it('clears a stored preview when the fix removes the link', async () => {
      const row = fixedRow('See the post please', preview);
      const { service, persist } = createFixHarness(row);

      const result = await fix(service, row.text_content);

      expect(persist.update).toHaveBeenCalledWith({ link_preview: null });
      expect(result.link_preview).toBeNull();
    });

    it('still publishes the fix when clearing the stored preview fails', async () => {
      const row = fixedRow('See the post please', preview);
      const { service, centrifugo } = createFixHarness(
        row,
        query({ data: null, error: { code: '57014', message: 'timeout' } }),
      );

      const result = await fix(service, row.text_content);

      expect(result.link_preview).toBeNull();
      expect(centrifugo.publish).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        `chat.link_preview_persist_failed message=${messageId} code=57014`,
      );
    });
  });

  describe('forwardMessage', () => {
    const userId = 'forwarder-1';

    function createForwardHarness(text: string, failWrites = false) {
      const original = {
        id: 'message-fwd-1',
        room_id: 'room-source',
        sender_id: 'author-1',
        message_type: 'text',
        text_content: text,
        media_url: null,
      };
      const chatMessageQueries: Stub[] = [];
      let inserted = 0;
      const from = vi.fn((table: string) => {
        if (table === 'chat_messages') {
          const stub =
            chatMessageQueries.length === 0
              ? query(ok(original))
              : query(ok(null));
          // Ids are handed out when a row is actually inserted, so the
          // follow-up preview writes do not consume them.
          if (chatMessageQueries.length > 0) {
            if (failWrites) {
              // Awaiting the query is the preview write; `single` is the insert.
              stub.then.mockImplementation(
                (resolve: (value: QueryResult) => unknown) =>
                  resolve({
                    data: null,
                    error: { code: '57014', message: 'canceled' },
                  }),
              );
            }
            stub.single.mockImplementation(() => {
              inserted += 1;
              return Promise.resolve(
                ok({
                  id: `forwarded-${inserted}`,
                  sender_id: userId,
                  message_type: 'text',
                  text_content: text,
                  is_forwarded: true,
                }),
              );
            });
          }
          chatMessageQueries.push(stub);
          return stub;
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
      return { ...createService(from), chatMessageQueries };
    }

    it('stores the forwarded link preview on every forwarded copy', async () => {
      const { service, getPreview, chatMessageQueries, centrifugo } =
        createForwardHarness('Worth reading: https://example.com/post.');
      getPreview.mockResolvedValue(preview);

      await service.forwardMessage(userId, 'message-fwd-1', [
        'room-b',
        'room-c',
      ]);

      expect(getPreview).toHaveBeenCalledTimes(1);
      const writes = writesTo(chatMessageQueries);
      expect(writes).toHaveLength(2);
      expect(writes.map((write) => write.id).sort()).toEqual([
        'forwarded-1',
        'forwarded-2',
      ]);
      for (const write of writes) {
        expect(write.payload).toEqual({ link_preview: preview });
      }
      expect(centrifugo.publish).toHaveBeenCalledTimes(2);
    });

    it('writes nothing when the forwarded text has no previewable link', async () => {
      const { service, getPreview, chatMessageQueries } =
        createForwardHarness('Just words');

      await service.forwardMessage(userId, 'message-fwd-1', [
        'room-b',
        'room-c',
      ]);

      expect(getPreview).not.toHaveBeenCalled();
      expect(writesTo(chatMessageQueries)).toHaveLength(0);
    });

    it('still forwards to every room, preview included, when the writes fail', async () => {
      const { service, getPreview, centrifugo } = createForwardHarness(
        'Worth reading: https://example.com/post.',
        true,
      );
      getPreview.mockResolvedValue(preview);

      const forwarded = await service.forwardMessage(userId, 'message-fwd-1', [
        'room-b',
        'room-c',
      ]);

      expect(forwarded).toHaveLength(2);
      expect(centrifugo.publish).toHaveBeenCalledTimes(2);
      for (const message of forwarded) {
        expect(message.link_preview).toEqual(preview);
      }
      expect(warn).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^chat\.link_preview_persist_failed message=forwarded-\d code=57014$/,
        ),
      );
    });
  });

  describe('reading stored previews', () => {
    const base = {
      room_id: 'room-1',
      sender_id: 'author-1',
      message_type: 'text',
      is_read: true,
      created_at: '2026-10-29T10:00:00.000Z',
    };

    const rows = [
      {
        ...base,
        id: 'matching',
        text_content: 'Read https://example.com/post today',
        link_preview: {
          ...preview,
          title: '<b>A post</b>',
        },
      },
      {
        ...base,
        id: 'stale-after-edit',
        text_content: 'Read https://other.test/page instead',
        link_preview: preview,
      },
      {
        ...base,
        id: 'link-removed',
        text_content: 'No link any more',
        link_preview: preview,
      },
      {
        ...base,
        id: 'malformed',
        text_content: 'Read https://example.com/post today',
        link_preview: 'not a preview',
      },
      {
        ...base,
        id: 'never-had-one',
        text_content: 'Read https://example.com/post today',
        link_preview: null,
      },
      {
        ...base,
        id: 'older-row-without-the-column',
        text_content: 'Hello',
      },
    ];

    function expectRestored(messages: Record<string, unknown>[]) {
      const byId = new Map(messages.map((m) => [m.id, m]));
      // Revalidated: markup stripped, still describes the linked page.
      expect(byId.get('matching')?.link_preview).toEqual(preview);
      // Stale, orphaned or malformed values never reach a client as a card.
      expect(byId.get('stale-after-edit')?.link_preview).toBeNull();
      expect(byId.get('link-removed')?.link_preview).toBeNull();
      expect(byId.get('malformed')?.link_preview).toBeNull();
      // Rows without a stored preview are returned exactly as stored.
      expect(byId.get('never-had-one')?.link_preview).toBeNull();
      expect(byId.get('older-row-without-the-column')).toEqual(
        rows[rows.length - 1],
      );
    }

    it('revalidates stored previews in the room history', async () => {
      const { service } = createService(
        vi.fn(() => query(ok(structuredClone(rows)))),
      );

      expectRestored(await service.getMessages('room-1'));
    });

    it('revalidates stored previews in a user-scoped search of one room', async () => {
      const { service } = createService(
        vi.fn(() => query(ok(structuredClone(rows)))),
      );

      expectRestored(await service.getMessages('room-1', 'post', 'viewer-1'));
    });

    it('revalidates stored previews in cross-room search', async () => {
      const from = vi.fn((table: string) =>
        table === 'chat_room_members'
          ? query(ok([{ room_id: 'room-1' }]))
          : query(ok(structuredClone(rows))),
      );
      const { service } = createService(from);

      expectRestored(await service.searchAllMessages('viewer-1', 'post'));
    });

    it('revalidates stored previews in the chat export', async () => {
      const from = vi.fn((table: string) =>
        table === 'chat_room_members'
          ? query(ok({ user_id: 'viewer-1' }))
          : query(ok(structuredClone(rows))),
      );
      const { service } = createService(from);

      expectRestored(await service.exportChatHistory('viewer-1', 'room-1'));
    });

    it('does not revalidate or scrape anything for rows without a preview', async () => {
      const { service, linkPreviews, getPreview } = createService(
        vi.fn(() => query(ok([rows[4], rows[5]]))),
      );
      const restore = vi.spyOn(linkPreviews, 'restoreStoredPreview');

      await service.getMessages('room-1');

      expect(restore).not.toHaveBeenCalled();
      expect(getPreview).not.toHaveBeenCalled();
    });

    it('keeps hiding messages deleted for the viewer while restoring the rest', async () => {
      const hidden = {
        ...rows[0],
        id: 'hidden',
        deleted_for_user_ids: ['viewer-1'],
      };
      const { service } = createService(
        vi.fn(() => query(ok([hidden, structuredClone(rows[0])]))),
      );

      const messages = await service.getMessages('room-1', 'post', 'viewer-1');

      expect(messages.map((m) => m.id)).toEqual(['matching']);
      expect(messages[0].link_preview).toEqual(preview);
    });
  });
});
