import { ForbiddenException } from '@nestjs/common';
import { MessageReactionsService } from './message-reactions.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from './centrifugo.service';

describe('MessageReactionsService', () => {
  const logger = { warn: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects reaction mutations from users outside the room', async () => {
    const messageQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'message-1', room_id: 'room-1', is_deleted: false },
        error: null,
      }),
    };
    const membershipQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const client = {
      from: vi.fn((table: string) =>
        table === 'chat_messages' ? messageQuery : membershipQuery,
      ),
    };
    const publish = vi.fn();
    const service = new MessageReactionsService(
      logger as never,
      { getClient: () => client } as unknown as SupabaseService,
      { publish } as unknown as CentrifugoService,
    );

    await expect(service.setReaction('outsider', 'message-1', '❤️', true)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(client.from).not.toHaveBeenCalledWith('message_reactions');
    expect(publish).not.toHaveBeenCalled();
  });

  it('upserts the desired reaction idempotently and publishes authoritative state', async () => {
    const messageQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'message-1', room_id: 'room-1', is_deleted: false },
        error: null,
      }),
    };
    const membershipQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: 'user-1' }, error: null }),
    };
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const mutationQuery = { upsert };
    const stateQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ message_id: 'message-1', user_id: 'user-1', emoji: '❤️' }],
        error: null,
      }),
    };
    let reactionQueryCount = 0;
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'chat_messages') return messageQuery;
        if (table === 'chat_room_members') return membershipQuery;
        reactionQueryCount += 1;
        return reactionQueryCount === 1 ? mutationQuery : stateQuery;
      }),
    };
    const publish = vi.fn().mockResolvedValue(undefined);
    const service = new MessageReactionsService(
      logger as never,
      { getClient: () => client } as unknown as SupabaseService,
      { publish } as unknown as CentrifugoService,
    );

    await expect(service.setReaction('user-1', 'message-1', '❤️', true)).resolves.toEqual({
      message_id: 'message-1',
      reactions: [{ user_id: 'user-1', emoji: '❤️' }],
    });
    expect(upsert).toHaveBeenCalledWith(
      { message_id: 'message-1', user_id: 'user-1', emoji: '❤️' },
      { onConflict: 'message_id,user_id,emoji', ignoreDuplicates: true },
    );
    expect(publish).toHaveBeenCalledWith('chat:room-1', {
      reaction: {
        message_id: 'message-1',
        reactions: [{ user_id: 'user-1', emoji: '❤️' }],
      },
    });
  });

  it('loads reactions for at most the bounded room message window', async () => {
    const membershipQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: 'user-1' }, error: null }),
    };
    const messageQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [{ id: 'message-1' }, { id: 'message-2' }],
        error: null,
      }),
    };
    const reactionQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { message_id: 'message-1', user_id: 'user-1', emoji: '👍' },
          { message_id: 'message-1', user_id: 'user-2', emoji: '👍' },
        ],
        error: null,
      }),
    };
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'chat_room_members') return membershipQuery;
        if (table === 'chat_messages') return messageQuery;
        return reactionQuery;
      }),
    };
    const service = new MessageReactionsService(
      logger as never,
      { getClient: () => client } as unknown as SupabaseService,
      { publish: vi.fn() } as unknown as CentrifugoService,
    );

    await expect(service.getRoomReactions('user-1', 'room-1')).resolves.toEqual({
      reactions: {
        'message-1': [
          { user_id: 'user-1', emoji: '👍' },
          { user_id: 'user-2', emoji: '👍' },
        ],
      },
    });
    expect(messageQuery.limit).toHaveBeenCalledWith(100);
    expect(reactionQuery.in).toHaveBeenCalledWith('message_id', ['message-1', 'message-2']);
  });
});
