import type { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import type { UsersService } from '../users/users.service';
import type { CentrifugoService } from '../chat/centrifugo.service';
import type { TranscriptEgressService } from './transcript-egress.service';
import type { NlpService } from '../nlp/nlp.service';
import type { R2Service } from '../cloudflare-r2/r2.service';
import type { ChatLlmService } from '../chat/chat-llm.service';
import type { AdminAuditService } from '../admin/admin-audit.service';
import { AudioRoomsService } from './audio-rooms.service';

interface QueryResult {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

class QueryStub implements PromiseLike<QueryResult> {
  readonly eq = vi.fn(() => this);
  readonly order = vi.fn(() => this);
  readonly limit = vi.fn(() => this);
  readonly select = vi.fn(() => this);
  readonly insert = vi.fn(() => this);

  constructor(
    private readonly result: QueryResult,
    private readonly singleResult: QueryResult = result,
  ) {}

  single(): Promise<QueryResult> {
    return Promise.resolve(this.singleResult);
  }

  maybeSingle(): Promise<QueryResult> {
    return Promise.resolve(this.singleResult);
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

describe('AudioRoomsService quick polls', () => {
  const publish = vi.fn().mockResolvedValue(true);
  const tableQueues = new Map<string, QueryStub[]>();
  const from = vi.fn((table: string) => {
    const query = tableQueues.get(table)?.shift();
    if (!query) throw new Error(`Missing query stub for ${table}`);
    return query;
  });
  let service: AudioRoomsService;

  function queue(table: string, ...queries: QueryStub[]): void {
    tableQueues.set(table, queries);
  }

  function queueActiveRoom(): void {
    queue(
      'audio_rooms',
      new QueryStub(
        { data: null, error: null },
        {
          data: {
            id: 'room-1',
            host_id: 'host-1',
            is_active: true,
            is_private: false,
            invited_user_ids: [],
          },
          error: null,
        },
      ),
    );
  }

  beforeEach(() => {
    tableQueues.clear();
    publish.mockReset().mockResolvedValue(true);
    from.mockClear();

    const config = {
      get: vi.fn((key: string) => {
        if (key === 'LIVEKIT_URL') return 'https://test.livekit.cloud';
        if (key === 'LIVEKIT_API_KEY') return 'test-key';
        if (key === 'LIVEKIT_SECRET')
          return 'secret-secret-secret-secret-secret';
        return 'test';
      }),
    };
    const supabase = { getClient: () => ({ from }) };

    service = new AudioRoomsService(
      config as unknown as ConfigService,
      supabase as unknown as SupabaseService,
      {} as UsersService,
      { publish } as unknown as CentrifugoService,
      {} as TranscriptEgressService,
      {} as NlpService,
      {} as R2Service,
      {} as ChatLlmService,
      {
        record: vi.fn().mockResolvedValue(undefined),
      } as unknown as AdminAuditService,
    );
  });

  it('creates a normalised poll only for the active room host and broadcasts it', async () => {
    const roomQuery = new QueryStub(
      { data: null, error: null },
      {
        data: { id: 'room-1', host_id: 'host-1', is_active: true },
        error: null,
      },
    );
    const pollQuery = new QueryStub(
      { data: null, error: null },
      { data: { id: 'poll-1' }, error: null },
    );
    queue('audio_rooms', roomQuery);
    queue('quick_polls', pollQuery);

    await expect(
      service.createPoll('host-1', 'room-1', {
        question: '  Next topic?  ',
        options: [' Travel ', ' Food '],
      }),
    ).resolves.toEqual({ poll_id: 'poll-1' });

    expect(pollQuery.insert).toHaveBeenCalledWith({
      room_id: 'room-1',
      host_id: 'host-1',
      question: 'Next topic?',
      options: ['Travel', 'Food'],
    });
    expect(publish).toHaveBeenCalledWith('room_room-1', {
      type: 'poll_opened',
      poll_id: 'poll-1',
      question: 'Next topic?',
      options: ['Travel', 'Food'],
    });
  });

  it('rejects a non-host and an inactive room before inserting', async () => {
    queue(
      'audio_rooms',
      new QueryStub(
        { data: null, error: null },
        {
          data: { id: 'room-1', host_id: 'host-1', is_active: true },
          error: null,
        },
      ),
    );
    await expect(
      service.createPoll('listener-1', 'room-1', {
        question: 'Question?',
        options: ['A', 'B'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    queue(
      'audio_rooms',
      new QueryStub(
        { data: null, error: null },
        {
          data: { id: 'room-1', host_id: 'host-1', is_active: false },
          error: null,
        },
      ),
    );
    await expect(
      service.createPoll('host-1', 'room-1', {
        question: 'Question?',
        options: ['A', 'B'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(from).not.toHaveBeenCalledWith('poll_votes');
    expect(publish).not.toHaveBeenCalled();
  });

  it('rejects poll content that becomes invalid after normalisation', async () => {
    queue(
      'audio_rooms',
      new QueryStub(
        { data: null, error: null },
        {
          data: { id: 'room-1', host_id: 'host-1', is_active: true },
          error: null,
        },
      ),
    );

    await expect(
      service.createPoll('host-1', 'room-1', {
        question: '   ',
        options: ['Travel', ' travel '],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(from).not.toHaveBeenCalledWith('quick_polls');
    expect(publish).not.toHaveBeenCalled();
  });

  it('binds results to the route room and returns the caller vote', async () => {
    const pollQuery = new QueryStub(
      { data: null, error: null },
      {
        data: {
          id: 'poll-1',
          question: 'Next topic?',
          options: ['Travel', 'Food'],
          is_active: true,
        },
        error: null,
      },
    );
    const votesQuery = new QueryStub({
      data: [{ option_index: 0 }, { option_index: 1 }, { option_index: 1 }],
      error: null,
    });
    const userVoteQuery = new QueryStub(
      { data: null, error: null },
      { data: { option_index: 1 }, error: null },
    );
    queueActiveRoom();
    queue('quick_polls', pollQuery);
    queue('poll_votes', votesQuery, userVoteQuery);

    await expect(
      service.getPollResults('user-1', 'room-1', 'poll-1'),
    ).resolves.toEqual({
      poll_id: 'poll-1',
      question: 'Next topic?',
      options: ['Travel', 'Food'],
      votes: [1, 2],
      totalVotes: 3,
      is_active: true,
      userVote: 1,
    });
    expect(pollQuery.eq).toHaveBeenCalledWith('room_id', 'room-1');
  });

  it('returns null when the room has no active poll', async () => {
    queueActiveRoom();
    queue(
      'quick_polls',
      new QueryStub({ data: null, error: null }, { data: null, error: null }),
    );

    await expect(service.getActivePoll('user-1', 'room-1')).resolves.toBeNull();
  });

  it('treats nullable privacy fields as public room access', async () => {
    queue(
      'audio_rooms',
      new QueryStub(
        { data: null, error: null },
        {
          data: {
            id: 'room-1',
            host_id: 'host-1',
            is_active: true,
            is_private: null,
            invited_user_ids: null,
          },
          error: null,
        },
      ),
    );
    queue(
      'quick_polls',
      new QueryStub({ data: null, error: null }, { data: null, error: null }),
    );

    await expect(service.getActivePoll('user-1', 'room-1')).resolves.toBeNull();
  });

  it('rejects poll recovery and voting for an uninvited private-room user', async () => {
    queue(
      'audio_rooms',
      new QueryStub(
        { data: null, error: null },
        {
          data: {
            id: 'room-1',
            host_id: 'host-1',
            is_active: true,
            is_private: true,
            invited_user_ids: ['invited-user'],
          },
          error: null,
        },
      ),
    );

    await expect(
      service.getActivePoll('uninvited-user', 'room-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(from).not.toHaveBeenCalledWith('quick_polls');

    queue(
      'quick_polls',
      new QueryStub(
        { data: null, error: null },
        {
          data: {
            id: 'poll-1',
            room_id: 'room-1',
            is_active: true,
            options: ['A', 'B'],
          },
          error: null,
        },
      ),
    );
    queue(
      'audio_rooms',
      new QueryStub(
        { data: null, error: null },
        {
          data: {
            id: 'room-1',
            host_id: 'host-1',
            is_active: true,
            is_private: true,
            invited_user_ids: ['invited-user'],
          },
          error: null,
        },
      ),
    );

    await expect(
      service.submitVote('uninvited-user', {
        pollId: 'poll-1',
        optionIndex: 0,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(from).not.toHaveBeenCalledWith('poll_votes');
  });

  it('broadcasts aggregate results only after a vote commits', async () => {
    queue(
      'quick_polls',
      new QueryStub(
        { data: null, error: null },
        {
          data: {
            id: 'poll-1',
            room_id: 'room-1',
            is_active: true,
            options: ['Travel', 'Food'],
          },
          error: null,
        },
      ),
      new QueryStub(
        { data: null, error: null },
        {
          data: {
            id: 'poll-1',
            question: 'Next topic?',
            options: ['Travel', 'Food'],
            is_active: true,
          },
          error: null,
        },
      ),
    );
    queue(
      'poll_votes',
      new QueryStub({ data: null, error: null }),
      new QueryStub({ data: [{ option_index: 1 }], error: null }),
    );
    queueActiveRoom();

    await service.submitVote('user-1', { pollId: 'poll-1', optionIndex: 1 });

    expect(publish).toHaveBeenCalledWith('room_room-1', {
      type: 'poll_updated',
      poll_id: 'poll-1',
      question: 'Next topic?',
      options: ['Travel', 'Food'],
      votes: [0, 1],
      totalVotes: 1,
      is_active: true,
    });
  });

  it('accepts an exact vote retry without publishing it twice', async () => {
    queue(
      'quick_polls',
      new QueryStub(
        { data: null, error: null },
        {
          data: {
            id: 'poll-1',
            room_id: 'room-1',
            is_active: true,
            options: ['A', 'B'],
          },
          error: null,
        },
      ),
    );
    queue(
      'poll_votes',
      new QueryStub({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      }),
      new QueryStub(
        { data: null, error: null },
        { data: { option_index: 0 }, error: null },
      ),
    );
    queueActiveRoom();

    await expect(
      service.submitVote('user-1', { pollId: 'poll-1', optionIndex: 0 }),
    ).resolves.toBeUndefined();
    expect(publish).not.toHaveBeenCalled();
  });

  it('rejects a conflicting vote retry and a missing poll', async () => {
    queue(
      'quick_polls',
      new QueryStub(
        { data: null, error: null },
        {
          data: {
            id: 'poll-1',
            room_id: 'room-1',
            is_active: true,
            options: ['A', 'B'],
          },
          error: null,
        },
      ),
    );
    queue(
      'poll_votes',
      new QueryStub({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      }),
      new QueryStub(
        { data: null, error: null },
        { data: { option_index: 1 }, error: null },
      ),
    );
    queueActiveRoom();

    await expect(
      service.submitVote('user-1', { pollId: 'poll-1', optionIndex: 0 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(publish).not.toHaveBeenCalled();

    queue(
      'quick_polls',
      new QueryStub(
        { data: null, error: null },
        { data: null, error: { message: 'not found' } },
      ),
    );
    await expect(
      service.submitVote('user-1', { pollId: 'missing', optionIndex: 0 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a vote after the audio room has ended', async () => {
    queue(
      'quick_polls',
      new QueryStub(
        { data: null, error: null },
        {
          data: {
            id: 'poll-1',
            room_id: 'room-1',
            is_active: true,
            options: ['A', 'B'],
          },
          error: null,
        },
      ),
    );
    queue(
      'audio_rooms',
      new QueryStub(
        { data: null, error: null },
        { data: { is_active: false }, error: null },
      ),
    );

    await expect(
      service.submitVote('user-1', { pollId: 'poll-1', optionIndex: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(from).not.toHaveBeenCalledWith('poll_votes');
    expect(publish).not.toHaveBeenCalled();
  });
});
