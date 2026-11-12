import type { Mock } from 'vitest';

// ChatService imports LinkPreviewService, which pulls these browser-oriented
// dependencies into the Vitest module graph even though this suite mocks the
// service boundary itself.
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

import { ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import type { SendMessageDto } from './dto/send-message.dto';

type QueryResult = {
  data: unknown;
  error: { message?: string; code?: string } | null;
};

type RoomMembersQuery = {
  select: Mock;
  eq: Mock;
  neq: Mock;
};

type MessagesQuery = {
  select: Mock;
  eq: Mock;
  maybeSingle: Mock;
  insert: Mock;
  single: Mock;
};

const CLIENT_MESSAGE_ID = '4d83362d-829e-4a68-b7bd-941076fb71f3';

function createRoomMembersQuery(
  members: { user_id: string }[] = [],
): RoomMembersQuery {
  const query = {} as RoomMembersQuery;
  query.select = vi.fn().mockReturnValue(query);
  query.eq = vi.fn().mockReturnValue(query);
  query.neq = vi.fn().mockResolvedValue({ data: members, error: null });
  return query;
}

function createMessagesQuery(
  lookups: QueryResult[],
  insertResult: QueryResult,
): MessagesQuery {
  const query = {} as MessagesQuery;
  query.select = vi.fn().mockReturnValue(query);
  query.eq = vi.fn().mockReturnValue(query);
  query.maybeSingle = vi.fn();
  for (const lookup of lookups) {
    query.maybeSingle.mockResolvedValueOnce(lookup);
  }
  query.insert = vi.fn().mockReturnValue(query);
  query.single = vi.fn().mockResolvedValue(insertResult);
  return query;
}

describe('ChatService idempotent message delivery', () => {
  const dto: SendMessageDto = {
    room_id: 'room-1',
    message_type: 'text',
    text_content: 'Queued while offline',
    client_message_id: CLIENT_MESSAGE_ID,
  };

  const storedMessage = {
    id: CLIENT_MESSAGE_ID,
    room_id: 'room-1',
    sender_id: 'sender-1',
    message_type: 'text',
    text_content: 'Queued while offline',
    media_url: null,
    correction_payload: null,
    delivery_status: 'sent',
    created_at: '2026-11-10T08:00:00.000Z',
  };

  const noRow: QueryResult = { data: null, error: null };

  function createService(
    lookups: QueryResult[],
    insertResult: QueryResult = { data: storedMessage, error: null },
    options: {
      members?: { user_id: string }[];
      blockRelations?: Record<string, string[]>;
    } = {},
  ) {
    const roomMembersQuery = createRoomMembersQuery(options.members);
    const messagesQuery = createMessagesQuery(lookups, insertResult);
    const from = vi.fn((table: string) => {
      if (table === 'chat_room_members') return roomMembersQuery;
      if (table === 'chat_messages') return messagesQuery;
      throw new Error(`Unexpected table in test: ${table}`);
    });
    const centrifugoService = {
      publish: vi.fn().mockResolvedValue(undefined),
    };
    const eventEmitter = { emit: vi.fn() };
    const xpService = {
      awardXpForActivity: vi.fn().mockResolvedValue(undefined),
    };
    const spamDetection = { isSpam: vi.fn().mockReturnValue(false) };

    const service = new ChatService(
      { getClient: vi.fn().mockReturnValue({ from }) } as never,
      centrifugoService as never,
      undefined,
      eventEmitter as never,
      {
        getBlockedAndBlockerIds: vi.fn((userId: string) =>
          Promise.resolve(options.blockRelations?.[userId] ?? []),
        ),
      } as never,
      { getPreview: vi.fn() } as never,
      spamDetection as never,
      { proxyMessage: vi.fn() } as never,
      {} as never,
      xpService as never,
      {} as never,
      {} as never,
      {} as never,
    );

    return {
      service,
      from,
      roomMembersQuery,
      messagesQuery,
      centrifugoService,
      eventEmitter,
      xpService,
      spamDetection,
    };
  }

  function expectNoDeliverySideEffects(
    fixture: ReturnType<typeof createService>,
  ): void {
    expect(fixture.messagesQuery.insert).not.toHaveBeenCalled();
    expect(fixture.centrifugoService.publish).not.toHaveBeenCalled();
    expect(fixture.xpService.awardXpForActivity).not.toHaveBeenCalled();
    expect(fixture.eventEmitter.emit).not.toHaveBeenCalled();
  }

  it('persists a first delivery under the client generated id', async () => {
    const fixture = createService([noRow]);

    const result = await fixture.service.sendMessage('sender-1', dto);

    expect(fixture.messagesQuery.eq).toHaveBeenCalledWith(
      'id',
      CLIENT_MESSAGE_ID,
    );
    expect(fixture.messagesQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: CLIENT_MESSAGE_ID,
        room_id: 'room-1',
        sender_id: 'sender-1',
      }),
    );
    expect(fixture.centrifugoService.publish).toHaveBeenCalledTimes(1);
    expect(result).toEqual(storedMessage);
  });

  it('normalises the client id to the lowercase form stored by PostgreSQL', async () => {
    const fixture = createService([noRow]);

    await fixture.service.sendMessage('sender-1', {
      ...dto,
      client_message_id: CLIENT_MESSAGE_ID.toUpperCase(),
    });

    expect(fixture.messagesQuery.eq).toHaveBeenCalledWith(
      'id',
      CLIENT_MESSAGE_ID,
    );
    expect(fixture.messagesQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: CLIENT_MESSAGE_ID }),
    );
  });

  it('returns the stored message for a replay without repeating any delivery side effect', async () => {
    const fixture = createService([{ data: storedMessage, error: null }]);

    const result = await fixture.service.sendMessage('sender-1', dto);

    expect(result).toEqual(storedMessage);
    expectNoDeliverySideEffects(fixture);
    // The replay must not be re-judged as duplicate content by the spam filter,
    // nor trigger room membership or block lookups.
    expect(fixture.spamDetection.isSpam).not.toHaveBeenCalled();
    expect(fixture.from).not.toHaveBeenCalledWith('chat_room_members');
  });

  it('rejects an id already used by another sender without exposing that message', async () => {
    const fixture = createService([
      { data: { ...storedMessage, sender_id: 'someone-else' }, error: null },
    ]);

    await expect(
      fixture.service.sendMessage('sender-1', dto),
    ).rejects.toBeInstanceOf(ConflictException);
    expectNoDeliverySideEffects(fixture);
  });

  it('rejects an id already used for a different room', async () => {
    const fixture = createService([
      { data: { ...storedMessage, room_id: 'room-2' }, error: null },
    ]);

    await expect(
      fixture.service.sendMessage('sender-1', dto),
    ).rejects.toBeInstanceOf(ConflictException);
    expectNoDeliverySideEffects(fixture);
  });

  it('resolves a concurrent replay that loses the insert race to the winning row', async () => {
    const fixture = createService(
      [noRow, { data: storedMessage, error: null }],
      {
        data: null,
        error: { code: '23505', message: 'duplicate key value' },
      },
    );

    const result = await fixture.service.sendMessage('sender-1', dto);

    expect(result).toEqual(storedMessage);
    expect(fixture.messagesQuery.insert).toHaveBeenCalledTimes(1);
    expect(fixture.centrifugoService.publish).not.toHaveBeenCalled();
    expect(fixture.xpService.awardXpForActivity).not.toHaveBeenCalled();
    expect(fixture.eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('rejects a lost insert race when the winning row belongs to someone else', async () => {
    const fixture = createService(
      [
        noRow,
        { data: { ...storedMessage, sender_id: 'someone-else' }, error: null },
      ],
      { data: null, error: { code: '23505', message: 'duplicate key value' } },
    );

    await expect(
      fixture.service.sendMessage('sender-1', dto),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(fixture.centrifugoService.publish).not.toHaveBeenCalled();
  });

  it('surfaces the persistence failure when a unique violation has no retrievable row', async () => {
    const fixture = createService([noRow, noRow], {
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });

    await expect(fixture.service.sendMessage('sender-1', dto)).rejects.toThrow(
      'Failed to save message: duplicate key value',
    );
    expect(fixture.centrifugoService.publish).not.toHaveBeenCalled();
  });

  it('does not treat other persistence failures as a replay', async () => {
    const fixture = createService([noRow], {
      data: null,
      error: { code: '53300', message: 'too many connections' },
    });

    await expect(fixture.service.sendMessage('sender-1', dto)).rejects.toThrow(
      'Failed to save message: too many connections',
    );
    // One lookup before the insert, none after a non-unique failure.
    expect(fixture.messagesQuery.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('still inserts when the replay lookup itself fails, relying on the primary key', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const fixture = createService([
      { data: null, error: { message: 'lookup unavailable' } },
    ]);

    const result = await fixture.service.sendMessage('sender-1', dto);

    expect(fixture.messagesQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: CLIENT_MESSAGE_ID }),
    );
    expect(result).toEqual(storedMessage);
    // The diagnostic is a fixed code: no message id, user id or provider text.
    expect(warn).toHaveBeenCalledWith('chat.replay_lookup_failed');
    warn.mockRestore();
  });

  it('does not look up or assign an id when the client supplied none', async () => {
    const fixture = createService([]);
    const { client_message_id: _omitted, ...withoutId } = dto;
    void _omitted;

    await fixture.service.sendMessage('sender-1', withoutId);

    expect(fixture.messagesQuery.maybeSingle).not.toHaveBeenCalled();
    const inserted = fixture.messagesQuery.insert.mock.calls[0][0];
    expect(inserted).not.toHaveProperty('id');
  });

  describe('permanent policy refusals', () => {
    it('answers 403 when the receiver has blocked the sender so a replay discards the message', async () => {
      const fixture = createService(
        [noRow],
        { data: storedMessage, error: null },
        {
          members: [{ user_id: 'receiver-1' }],
          blockRelations: { 'receiver-1': ['sender-1'] },
        },
      );

      await expect(
        fixture.service.sendMessage('sender-1', dto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expectNoDeliverySideEffects(fixture);
    });

    it('answers 403 when the sender has blocked the receiver', async () => {
      const fixture = createService(
        [noRow],
        { data: storedMessage, error: null },
        {
          members: [{ user_id: 'receiver-1' }],
          blockRelations: { 'sender-1': ['receiver-1'] },
        },
      );

      await expect(
        fixture.service.sendMessage('sender-1', dto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expectNoDeliverySideEffects(fixture);
    });
  });
});
