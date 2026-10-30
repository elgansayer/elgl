import type { Mock } from 'vitest';

// SecureChatService extends ChatService, whose module graph imports the link
// preview scraper and therefore these browser-oriented dependencies.
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
import { SecureChatService } from './secure-chat.service';
import type { LinkPreview } from '../link-preview/interfaces/link-preview.interface';

type QueryResult = {
  data: unknown;
  error: { message?: string } | null;
};

function query(result: QueryResult): Record<string, Mock> {
  const stub: Record<string, Mock> = {};
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
  stub.single = vi.fn().mockResolvedValue(result);
  stub.maybeSingle = vi.fn().mockResolvedValue(result);
  stub.then = vi.fn((resolve: (value: QueryResult) => unknown) =>
    resolve(result),
  );
  return stub;
}

const ok = (data: unknown): QueryResult => ({ data, error: null });

const preview: LinkPreview = {
  url: 'https://example.com/group-post',
  title: 'Group post',
  description: 'Shared with the group',
  image: '',
  siteName: 'Example',
};

const savedMessage = {
  id: 'group-message-1',
  room_id: 'group-room-1',
  sender_id: 'member-1',
  message_type: 'text',
  text_content: 'placeholder',
  delivery_status: 'sent',
  created_at: '2026-10-28T10:00:00.000Z',
};

function createService(options: {
  roomType?: 'group' | 'direct';
  getPreview: Mock;
  restoreStoredPreview?: Mock;
  messageRows?: unknown;
  writeError?: { code: string; message: string };
}) {
  const roomMembers = query(
    ok([{ user_id: 'member-1' }, { user_id: 'member-2' }]),
  );
  // Membership checks use `maybeSingle`; the member list awaits the query.
  roomMembers.maybeSingle.mockResolvedValue(ok({ room_id: 'group-room-1' }));
  const rooms = query(
    ok({ type: options.roomType ?? 'group', is_deleted: false }),
  );
  const messages = query(ok(options.messageRows ?? savedMessage));
  if (options.writeError) {
    // Awaiting the query is the preview write; `single` is the insert.
    const writeError = options.writeError;
    messages.then.mockImplementation(
      (resolve: (value: QueryResult) => unknown) =>
        resolve({ data: null, error: writeError }),
    );
  }
  const from = vi.fn((table: string) => {
    if (table === 'chat_room_members') return roomMembers;
    if (table === 'chat_rooms') return rooms;
    if (table === 'chat_messages') return messages;
    throw new Error(`Unexpected table in test: ${table}`);
  });
  const centrifugo = { publish: vi.fn().mockResolvedValue(undefined) };
  const events = { emit: vi.fn() };

  const service = new SecureChatService(
    { getClient: vi.fn().mockReturnValue({ from }) } as never,
    centrifugo as never,
    undefined,
    events as never,
    { getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]) } as never,
    {
      getPreview: options.getPreview,
      restoreStoredPreview: options.restoreStoredPreview,
    } as never,
    { isSpam: vi.fn().mockReturnValue(false) } as never,
    {} as never,
    {} as never,
    { awardXpForActivity: vi.fn().mockResolvedValue(undefined) } as never,
    {} as never,
    { get: vi.fn() } as never,
    {} as never,
  );

  return { service, centrifugo, events, messages };
}

function published(centrifugo: { publish: Mock }): Record<string, unknown> {
  const [channel, payload] = centrifugo.publish.mock.calls[0] as [
    string,
    { message: Record<string, unknown> },
  ];
  expect(channel).toBe('chat:group-room-1');
  return payload.message;
}

describe('SecureChatService group link previews', () => {
  it('publishes the preview of the first link with every group member', async () => {
    const getPreview = vi.fn().mockResolvedValue(preview);
    const { service, centrifugo } = createService({ getPreview });

    const result = await service.sendMessage('member-1', {
      room_id: 'group-room-1',
      message_type: 'text',
      text_content: 'Everyone read https://example.com/group-post, please!',
    });

    expect(getPreview).toHaveBeenCalledTimes(1);
    expect(getPreview).toHaveBeenCalledWith('https://example.com/group-post');
    expect(published(centrifugo)).toEqual({
      ...savedMessage,
      link_preview: preview,
    });
    expect(result.link_preview).toEqual(preview);
  });

  it('never lets a failing scraper block a group send', async () => {
    const getPreview = vi.fn().mockRejectedValue(new Error('origin down'));
    const { service, centrifugo, events } = createService({ getPreview });

    const result = await service.sendMessage('member-1', {
      room_id: 'group-room-1',
      message_type: 'text',
      text_content: 'https://example.com/group-post',
    });

    expect(published(centrifugo)).toEqual(savedMessage);
    expect(result).toEqual(savedMessage);
    expect(events.emit).toHaveBeenCalledWith('message.sent', {
      userId: 'member-1',
    });
  });

  it('does not scrape text without a link or non-text group messages', async () => {
    const getPreview = vi.fn().mockResolvedValue(preview);
    const { service } = createService({ getPreview });

    await service.sendMessage('member-1', {
      room_id: 'group-room-1',
      message_type: 'text',
      text_content: 'just chatting',
    });
    await service.sendMessage('member-1', {
      room_id: 'group-room-1',
      message_type: 'correction_request',
      text_content: 'https://example.com/group-post',
    });

    expect(getPreview).not.toHaveBeenCalled();
  });

  it('stores the preview on the group message', async () => {
    const getPreview = vi.fn().mockResolvedValue(preview);
    const { service, messages } = createService({ getPreview });

    await service.sendMessage('member-1', {
      room_id: 'group-room-1',
      message_type: 'text',
      text_content: 'Everyone read https://example.com/group-post, please!',
    });

    expect(messages.update).toHaveBeenCalledWith({ link_preview: preview });
    expect(messages.eq).toHaveBeenCalledWith('id', 'group-message-1');
  });

  it('publishes to the group only once the preview is stored', async () => {
    const getPreview = vi.fn().mockResolvedValue(preview);
    const { service, centrifugo, messages } = createService({ getPreview });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Awaiting the query is the preview write; `single` is the insert.
    messages.then.mockImplementation(
      (resolve: (value: QueryResult) => unknown) => {
        void gate.then(() => resolve(ok(null)));
      },
    );

    const sending = service.sendMessage('member-1', {
      room_id: 'group-room-1',
      message_type: 'text',
      text_content: 'https://example.com/group-post',
    });
    await new Promise<void>((resolve) => setImmediate(resolve));

    // What members see live must already be in the history they load later.
    expect(messages.update).toHaveBeenCalled();
    expect(centrifugo.publish).not.toHaveBeenCalled();

    release();
    await sending;
    expect(centrifugo.publish).toHaveBeenCalledTimes(1);
  });

  it('writes nothing for group messages without a preview', async () => {
    const getPreview = vi.fn().mockRejectedValue(new Error('origin down'));
    const { service, messages } = createService({ getPreview });

    await service.sendMessage('member-1', {
      room_id: 'group-room-1',
      message_type: 'text',
      text_content: 'just chatting',
    });
    await service.sendMessage('member-1', {
      room_id: 'group-room-1',
      message_type: 'text',
      text_content: 'https://example.com/group-post',
    });

    expect(messages.update).not.toHaveBeenCalled();
  });

  it('still delivers to the group when the preview write fails', async () => {
    const getPreview = vi.fn().mockResolvedValue(preview);
    const { service, centrifugo, events } = createService({
      getPreview,
      writeError: { code: '42703', message: 'column does not exist' },
    });

    const result = await service.sendMessage('member-1', {
      room_id: 'group-room-1',
      message_type: 'text',
      text_content: 'https://example.com/group-post',
    });

    expect(published(centrifugo)).toEqual({
      ...savedMessage,
      link_preview: preview,
    });
    expect(result.link_preview).toEqual(preview);
    expect(events.emit).toHaveBeenCalledWith('message.sent', {
      userId: 'member-1',
    });
  });

  it('returns revalidated stored previews from group history', async () => {
    const stored = { ...preview, title: '<b>Group post</b>' };
    const restoreStoredPreview = vi.fn().mockReturnValue(preview);
    const { service } = createService({
      getPreview: vi.fn(),
      restoreStoredPreview,
      messageRows: [
        {
          ...savedMessage,
          text_content: 'Read https://example.com/group-post',
          link_preview: stored,
        },
        { ...savedMessage, id: 'group-message-2', text_content: 'No link' },
      ],
    });

    const messages = await service.getMessages(
      'group-room-1',
      'read',
      'member-2',
    );

    expect(restoreStoredPreview).toHaveBeenCalledTimes(1);
    expect(restoreStoredPreview).toHaveBeenCalledWith(
      stored,
      'Read https://example.com/group-post',
    );
    expect(messages[0].link_preview).toEqual(preview);
    expect(messages[1]).not.toHaveProperty('link_preview');
  });

  it('requires room membership before any outbound scrape', async () => {
    const getPreview = vi.fn().mockResolvedValue(preview);
    // Every lookup resolves to "no row", so the sender is not a member.
    const outsider = new SecureChatService(
      {
        getClient: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue(query(ok(null))),
        }),
      } as never,
      { publish: vi.fn() } as never,
      undefined,
      { emit: vi.fn() } as never,
      {} as never,
      { getPreview } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: vi.fn() } as never,
      {} as never,
    );

    await expect(
      outsider.sendMessage('outsider', {
        room_id: 'group-room-1',
        message_type: 'text',
        text_content: 'https://example.com/group-post',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(getPreview).not.toHaveBeenCalled();
  });
});
