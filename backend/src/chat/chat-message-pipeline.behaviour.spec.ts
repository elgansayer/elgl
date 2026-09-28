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

import { ChatService } from './chat.service';
import type { SendMessageDto } from './dto/send-message.dto';

type QueryResult = {
  data: unknown;
  error: { message?: string } | null;
};

type RoomMembersQuery = {
  select: Mock;
  eq: Mock;
  neq: Mock;
};

type MessageInsertQuery = {
  insert: Mock;
  select: Mock;
  single: Mock;
};

function createRoomMembersQuery(): RoomMembersQuery {
  const query = {} as RoomMembersQuery;
  query.select = vi.fn().mockReturnValue(query);
  query.eq = vi.fn().mockReturnValue(query);
  query.neq = vi.fn().mockResolvedValue({ data: [], error: null });
  return query;
}

function createMessageInsertQuery(result: QueryResult): MessageInsertQuery {
  const query = {} as MessageInsertQuery;
  query.insert = vi.fn().mockReturnValue(query);
  query.select = vi.fn().mockReturnValue(query);
  query.single = vi.fn().mockResolvedValue(result);
  return query;
}

describe('ChatService message persistence and realtime pipeline', () => {
  const dto: SendMessageDto = {
    room_id: 'room-1',
    message_type: 'text',
    text_content: 'Hello there',
  };

  const savedMessage = {
    id: 'message-1',
    room_id: 'room-1',
    sender_id: 'sender-1',
    message_type: 'text',
    text_content: 'Hello there',
    media_url: null,
    correction_payload: null,
    delivery_status: 'sent',
    created_at: '2026-08-28T20:00:00.000Z',
  };

  function createService(insertResult: QueryResult) {
    const roomMembersQuery = createRoomMembersQuery();
    const messageInsertQuery = createMessageInsertQuery(insertResult);
    const from = vi.fn((table: string) => {
      if (table === 'chat_room_members') return roomMembersQuery;
      if (table === 'chat_messages') return messageInsertQuery;
      throw new Error(`Unexpected table in test: ${table}`);
    });
    const centrifugoService = {
      publish: vi.fn().mockResolvedValue(undefined),
    };
    const eventEmitter = { emit: vi.fn() };
    const xpService = {
      awardXpForActivity: vi.fn().mockResolvedValue(undefined),
    };

    const service = new ChatService(
      { getClient: vi.fn().mockReturnValue({ from }) } as never,
      centrifugoService as never,
      undefined,
      eventEmitter as never,
      { getBlockedAndBlockerIds: vi.fn() } as never,
      { getPreview: vi.fn() } as never,
      { isSpam: vi.fn().mockReturnValue(false) } as never,
      { proxyMessage: vi.fn() } as never,
      {} as never,
      xpService as never,
      {} as never,
      {} as never,
    );

    return {
      service,
      roomMembersQuery,
      messageInsertQuery,
      centrifugoService,
      eventEmitter,
      xpService,
    };
  }

  it('persists the authenticated sender payload before publishing the saved message', async () => {
    const {
      service,
      messageInsertQuery,
      centrifugoService,
      eventEmitter,
      xpService,
    } = createService({ data: savedMessage, error: null });

    const result = await service.sendMessage('sender-1', dto);

    expect(messageInsertQuery.insert).toHaveBeenCalledWith({
      room_id: 'room-1',
      sender_id: 'sender-1',
      message_type: 'text',
      text_content: 'Hello there',
      media_url: null,
      correction_payload: null,
      reply_to_id: null,
      correction_request_payload: null,
      status_reply_payload: null,
      is_view_once: false,
      delivery_status: 'sent',
    });
    expect(centrifugoService.publish).toHaveBeenCalledWith('chat:room-1', {
      message: savedMessage,
    });
    expect(messageInsertQuery.single.mock.invocationCallOrder[0]).toBeLessThan(
      centrifugoService.publish.mock.invocationCallOrder[0],
    );
    expect(xpService.awardXpForActivity).toHaveBeenCalledWith(
      'sender-1',
      'send_message',
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith('message.sent', {
      userId: 'sender-1',
    });
    expect(result).toEqual(savedMessage);
  });

  it('fails closed on persistence errors without publishing or emitting success events', async () => {
    const { service, centrifugoService, eventEmitter, xpService } =
      createService({
        data: null,
        error: { message: 'database unavailable' },
      });

    await expect(service.sendMessage('sender-1', dto)).rejects.toThrow(
      'Failed to save message: database unavailable',
    );

    expect(centrifugoService.publish).not.toHaveBeenCalled();
    expect(xpService.awardXpForActivity).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
