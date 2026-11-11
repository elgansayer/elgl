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

type QueryResult = {
  data: unknown;
  error: { message?: string } | null;
};

const ok = (data: unknown): QueryResult => ({ data, error: null });

const sourceMessage = {
  id: 'message-1',
  room_id: 'group-room',
  sender_id: 'member-1',
  message_type: 'text',
  text_content: 'I goed home',
  delivery_status: 'sent',
  created_at: '2026-11-05T10:00:00.000Z',
};

const savedCorrection = {
  id: 'correction-1',
  room_id: 'group-room',
  sender_id: 'member-2',
  message_type: 'correction',
  correction_payload: {
    original: 'I goed home',
    corrected: 'I went home',
  },
  reply_to_id: 'message-1',
  delivery_status: 'sent',
  created_at: '2026-11-05T10:01:00.000Z',
};

function tableStub(): Record<string, Mock> {
  const stub: Record<string, Mock> = {};
  for (const method of [
    'select',
    'eq',
    'neq',
    'in',
    'not',
    'ilike',
    'order',
    'limit',
    'update',
    'delete',
  ]) {
    stub[method] = vi.fn().mockReturnValue(stub);
  }
  return stub;
}

function createService(options: { isMember: boolean; explanation?: string }) {
  let inserted = false;
  let insertedPayload: Record<string, unknown> | undefined;

  const messages = tableStub();
  messages.insert = vi.fn().mockImplementation((payload: unknown) => {
    inserted = true;
    insertedPayload = payload as Record<string, unknown>;
    return messages;
  });
  // The stored row carries the payload that was inserted.
  messages.single = vi.fn().mockImplementation(() =>
    Promise.resolve(
      inserted
        ? ok({
            ...savedCorrection,
            correction_payload: insertedPayload?.correction_payload,
          })
        : ok(sourceMessage),
    ),
  );
  // The enrichment update chain is awaited without a terminal filter call.
  messages.then = vi
    .fn()
    .mockImplementation((resolve: (value: QueryResult) => unknown) =>
      resolve(ok(null)),
    );

  const members = tableStub();
  members.maybeSingle = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(
        options.isMember ? ok({ room_id: 'group-room' }) : ok(null),
      ),
    );
  members.then = vi
    .fn()
    .mockImplementation((resolve: (value: QueryResult) => unknown) =>
      resolve(ok([{ user_id: 'member-1' }, { user_id: 'member-2' }])),
    );

  const rooms = tableStub();
  rooms.maybeSingle = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(ok({ type: 'group', is_deleted: false })),
    );

  const from = vi.fn((table: string) => {
    if (table === 'chat_messages') return messages;
    if (table === 'chat_room_members') return members;
    if (table === 'chat_rooms') return rooms;
    throw new Error(`Unexpected table in test: ${table}`);
  });

  const centrifugo = { publish: vi.fn().mockResolvedValue(undefined) };
  const events = { emit: vi.fn() };
  const chatLlm = {
    chatCompletion: vi
      .fn()
      .mockResolvedValue(options.explanation ? options.explanation : ''),
  };

  const service = new SecureChatService(
    { getClient: vi.fn().mockReturnValue({ from }) } as never,
    centrifugo as never,
    undefined,
    events as never,
    { getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]) } as never,
    { getPreview: vi.fn().mockResolvedValue(null) } as never,
    { isSpam: vi.fn().mockReturnValue(false) } as never,
    chatLlm as never,
    {} as never,
    { awardXpForActivity: vi.fn().mockResolvedValue(undefined) } as never,
    {} as never,
    { get: vi.fn() } as never,
    {} as never,
  );

  return { service, centrifugo, messages, chatLlm };
}

describe('SecureChatService correction authorisation', () => {
  it('rejects a correction from a sender who is not a room member', async () => {
    const { service, centrifugo, messages, chatLlm } = createService({
      isMember: false,
    });

    await expect(
      service.correctMessage(
        'outsider',
        'message-1',
        'I went home',
        'Went is the past tense of go.',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(messages.insert).not.toHaveBeenCalled();
    expect(centrifugo.publish).not.toHaveBeenCalled();
    expect(chatLlm.chatCompletion).not.toHaveBeenCalled();
  });

  it('stores a member correction in the source room and publishes it there', async () => {
    const { service, centrifugo, messages, chatLlm } = createService({
      isMember: true,
    });

    const result = await service.correctMessage(
      'member-2',
      'message-1',
      'I went home',
      'Went is the past tense of go.',
    );

    expect(result).toEqual({
      ...savedCorrection,
      correction_payload: {
        original: 'I goed home',
        corrected: 'I went home',
        explanation: 'Went is the past tense of go.',
      },
    });
    expect(messages.insert).toHaveBeenCalledTimes(1);
    expect(messages.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        room_id: 'group-room',
        sender_id: 'member-2',
        message_type: 'correction',
        reply_to_id: 'message-1',
        correction_payload: {
          original: 'I goed home',
          corrected: 'I went home',
          explanation: 'Went is the past tense of go.',
        },
      }),
    );
    expect(centrifugo.publish).toHaveBeenCalledTimes(1);
    expect(centrifugo.publish).toHaveBeenCalledWith('chat:group-room', {
      message: {
        ...savedCorrection,
        correction_payload: {
          original: 'I goed home',
          corrected: 'I went home',
          explanation: 'Went is the past tense of go.',
        },
      },
    });
    // A correction that already carries a teaching note is never re-enriched.
    expect(chatLlm.chatCompletion).not.toHaveBeenCalled();
  });

  it('enriches a group correction that carries no explanation', async () => {
    const { service, centrifugo, messages, chatLlm } = createService({
      isMember: true,
      explanation: 'Went is the past tense of go.',
    });

    const result = await service.correctMessage(
      'member-2',
      'message-1',
      'I went home',
    );

    const enrichedPayload = {
      original: 'I goed home',
      corrected: 'I went home',
      explanation: 'Went is the past tense of go.',
    };

    expect(chatLlm.chatCompletion).toHaveBeenCalledTimes(1);
    expect(messages.update).toHaveBeenCalledWith({
      correction_payload: enrichedPayload,
    });
    expect(result.correction_payload).toEqual(enrichedPayload);
    expect(centrifugo.publish).toHaveBeenCalledWith('chat:group-room', {
      message: expect.objectContaining({
        correction_payload: enrichedPayload,
      }),
    });
  });
});
