import {
  BadRequestException,
  ForbiddenException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ChatService } from './chat.service';
import type { SendMessageDto } from './dto/send-message.dto';

type QueryResult = {
  data: unknown;
  error: { message?: string } | null;
};

function createMaybeSingleQuery(result: QueryResult) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

function createOtherMembersQuery() {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

function createInsertQuery(savedMessage: Record<string, unknown>) {
  const query = {
    insert: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: savedMessage, error: null }),
  };
  query.insert.mockReturnValue(query);
  query.select.mockReturnValue(query);
  return query;
}

function buildService(options: {
  membership?: QueryResult;
  source?: QueryResult;
}) {
  const membershipQuery = createMaybeSingleQuery(
    options.membership ?? { data: { user_id: 'learner-1' }, error: null },
  );
  const sourceQuery = createMaybeSingleQuery(
    options.source ?? {
      data: {
        room_id: 'group-room',
        message_type: 'text',
        text_content: 'I goed home',
      },
      error: null,
    },
  );
  const otherMembersQuery = createOtherMembersQuery();
  const savedMessage = {
    id: 'request-1',
    room_id: 'group-room',
    sender_id: 'learner-1',
    message_type: 'correction_request',
    correction_request_payload: { original_text: 'I goed home' },
    reply_to_id: 'message-1',
  };
  const insertQuery = createInsertQuery(savedMessage);
  let membershipCalls = 0;
  let messageCalls = 0;
  const from = vi.fn((table: string) => {
    if (table === 'chat_room_members') {
      membershipCalls += 1;
      return membershipCalls === 1 ? membershipQuery : otherMembersQuery;
    }
    if (table === 'chat_messages') {
      messageCalls += 1;
      return messageCalls === 1 ? sourceQuery : insertQuery;
    }
    throw new Error(`Unexpected table in test: ${table}`);
  });
  const publish = vi.fn().mockResolvedValue(true);

  const service = new ChatService(
    { getClient: vi.fn().mockReturnValue({ from }) } as never,
    { publish } as never,
    undefined,
    { emit: vi.fn() } as never,
    { getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]) } as never,
    {} as never,
    { isSpam: vi.fn().mockReturnValue(false) } as never,
    {} as never,
    {} as never,
    { awardXpForActivity: vi.fn() } as never,
    {} as never,
    {} as never,
    {} as never,
  );

  return { service, sourceQuery, insertQuery, publish, savedMessage };
}

const requestDto: SendMessageDto = {
  room_id: 'group-room',
  message_type: 'correction_request',
  correction_request_payload: {
    original_text: 'untrusted client snapshot',
    target_language: 'en',
  },
  reply_to_id: 'message-1',
};

describe('group chat correction request contract', () => {
  it('persists the canonical source text and publishes the saved request', async () => {
    const { service, insertQuery, publish, savedMessage } = buildService({});

    await expect(service.sendMessage('learner-1', requestDto)).resolves.toEqual(
      savedMessage,
    );

    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        room_id: 'group-room',
        sender_id: 'learner-1',
        message_type: 'correction_request',
        reply_to_id: 'message-1',
        correction_request_payload: {
          original_text: 'I goed home',
          target_language: 'en',
        },
      }),
    );
    expect(publish).toHaveBeenCalledWith('chat:group-room', {
      message: savedMessage,
    });
  });

  it('rejects a correction request from a non-member before reading the source', async () => {
    const { service, sourceQuery, insertQuery, publish } = buildService({
      membership: { data: null, error: null },
    });

    await expect(
      service.sendMessage('outsider', requestDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(sourceQuery.maybeSingle).not.toHaveBeenCalled();
    expect(insertQuery.insert).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('rejects a correction request linked to another room', async () => {
    const { service, insertQuery, publish } = buildService({
      source: {
        data: {
          room_id: 'different-room',
          message_type: 'text',
          text_content: 'Private source text',
        },
        error: null,
      },
    });

    await expect(
      service.sendMessage('learner-1', requestDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(insertQuery.insert).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('rejects a non-text source message before insertion', async () => {
    const { service, insertQuery, publish } = buildService({
      source: {
        data: {
          room_id: 'group-room',
          message_type: 'voice',
          text_content: null,
        },
        error: null,
      },
    });

    await expect(
      service.sendMessage('learner-1', requestDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(insertQuery.insert).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('fails closed with a sanitised log when the membership lookup is unavailable', async () => {
    const errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { service, sourceQuery, insertQuery, publish } = buildService({
      membership: { data: null, error: { message: 'provider unavailable' } },
    });

    await expect(
      service.sendMessage('learner-1', requestDto),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(errorSpy).toHaveBeenCalledWith(
      'chat.correction_request_membership_lookup_failed',
    );
    expect(sourceQuery.maybeSingle).not.toHaveBeenCalled();
    expect(insertQuery.insert).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('fails closed when the source message lookup is unavailable', async () => {
    const { service, insertQuery, publish } = buildService({
      source: { data: null, error: { message: 'provider unavailable' } },
    });

    await expect(
      service.sendMessage('learner-1', requestDto),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(insertQuery.insert).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});
