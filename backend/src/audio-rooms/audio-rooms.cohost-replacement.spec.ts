import { ServiceUnavailableException } from '@nestjs/common';
import { AudioRoomsService } from './audio-rooms.service';

describe('AudioRoomsService co-host replacement', () => {
  const roomBefore = {
    id: 'room-1',
    room_name: 'language-room-1',
    title: 'Language room',
    target_language: 'ja',
    language_pair: 'en-ja',
    topic_tag: 'general',
    host_id: 'host-1',
    co_host_id: 'user-2',
    is_video_stream: true,
    is_active: true,
    speakers: ['host-1', 'user-2'],
    raised_hands: ['user-3'],
    listeners_count: 2,
    created_at: '2026-08-22T00:00:00.000Z',
  };

  const roomAfter = {
    ...roomBefore,
    co_host_id: 'user-3',
    speakers: ['host-1', 'user-3'],
    raised_hands: [],
  };

  function createHarness(options?: {
    participants?: Array<{ identity: string }>;
    updateParticipantError?: Error;
  }) {
    const sequence: string[] = [];

    const queryBuilder: Record<string, unknown> & {
      error: null;
      select: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      single: ReturnType<typeof vi.fn>;
    } = {
      error: null,
      select: vi.fn(),
      update: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    };

    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.eq.mockReturnValue(queryBuilder);
    queryBuilder.update.mockImplementation(
      (payload: { co_host_id?: string | null }) => {
        if (payload.co_host_id === null) sequence.push('db-demote');
        if (payload.co_host_id === 'user-3') sequence.push('db-assign');
        return queryBuilder;
      },
    );
    queryBuilder.single
      .mockResolvedValueOnce({ data: roomBefore, error: null })
      .mockResolvedValueOnce({ data: roomAfter, error: null });

    const supabaseClient = {
      from: vi.fn().mockReturnValue(queryBuilder),
    };

    const centrifugo = {
      publish: vi
        .fn()
        .mockImplementation(
          async (
            _channel: string,
            payload: { type: string },
          ): Promise<boolean> => {
            if (payload.type === 'co_host_removed')
              sequence.push('notify-remove');
            if (payload.type === 'co_host_changed')
              sequence.push('notify-change');
            return true;
          },
        ),
    };

    const livekitClient = {
      listParticipants: vi.fn().mockImplementation(async () => {
        sequence.push('livekit-list');
        return options?.participants ?? [{ identity: 'Old Cohost_user-2' }];
      }),
      updateParticipant: vi.fn().mockImplementation(async () => {
        sequence.push('livekit-revoke');
        if (options?.updateParticipantError) {
          throw options.updateParticipantError;
        }
        return {};
      }),
    };

    const config = {
      get: vi.fn((key: string) => {
        if (key === 'LIVEKIT_URL') return 'https://test.livekit.cloud';
        if (key === 'LIVEKIT_API_KEY') return 'test-key';
        if (key === 'LIVEKIT_SECRET') return 'test-secret';
        return undefined;
      }),
    };
    const users = {
      getProfile: vi.fn().mockResolvedValue({
        id: 'host-1',
        display_name: 'Host',
        avatar_url: null,
      }),
    };

    const service = new AudioRoomsService(
      config as never,
      { getClient: () => supabaseClient } as never,
      users as never,
      centrifugo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    (
      service as unknown as {
        roomServiceClient: typeof livekitClient;
      }
    ).roomServiceClient = livekitClient;

    return {
      service,
      sequence,
      queryBuilder,
      centrifugo,
      livekitClient,
    };
  }

  it('revokes publish, demotes, and notifies the old co-host before assignment', async () => {
    const { service, sequence, livekitClient, centrifugo } = createHarness();

    const result = await service.inviteCoHost('host-1', {
      room_id: 'room-1',
      target_user_id: 'user-3',
    });

    expect(sequence).toEqual([
      'livekit-list',
      'livekit-revoke',
      'db-demote',
      'notify-remove',
      'db-assign',
      'notify-change',
    ]);
    expect(livekitClient.updateParticipant).toHaveBeenCalledWith(
      'language-room-1',
      'Old Cohost_user-2',
      {
        permission: {
          canSubscribe: true,
          canPublish: false,
          canPublishData: true,
        },
      },
    );
    expect(centrifugo.publish).toHaveBeenNthCalledWith(1, 'room_room-1', {
      type: 'co_host_removed',
      target_user_id: 'user-2',
      room_id: 'room-1',
    });
    expect(centrifugo.publish).toHaveBeenNthCalledWith(2, 'room_room-1', {
      type: 'co_host_changed',
      target_user_id: 'user-3',
      previous_co_host_id: 'user-2',
      room_id: 'room-1',
    });
    expect(result.co_host_id).toBe('user-3');
  });

  it('fails closed before persistence when LiveKit cannot revoke publishing', async () => {
    const { service, queryBuilder, centrifugo } = createHarness({
      updateParticipantError: new Error('media plane unavailable'),
    });

    await expect(
      service.inviteCoHost('host-1', {
        room_id: 'room-1',
        target_user_id: 'user-3',
      }),
    ).rejects.toThrow(ServiceUnavailableException);

    expect(queryBuilder.update).not.toHaveBeenCalled();
    expect(centrifugo.publish).not.toHaveBeenCalled();
  });

  it('continues safely when the previous co-host is already disconnected', async () => {
    const { service, sequence, livekitClient } = createHarness({
      participants: [],
    });

    await service.inviteCoHost('host-1', {
      room_id: 'room-1',
      target_user_id: 'user-3',
    });

    expect(livekitClient.updateParticipant).not.toHaveBeenCalled();
    expect(sequence).toEqual([
      'livekit-list',
      'db-demote',
      'notify-remove',
      'db-assign',
      'notify-change',
    ]);
  });

  it('fails closed when a legacy identity suffix is ambiguous', async () => {
    const { service, queryBuilder, centrifugo } = createHarness({
      participants: [{ identity: 'One_user-2' }, { identity: 'Two_user-2' }],
    });

    await expect(
      service.inviteCoHost('host-1', {
        room_id: 'room-1',
        target_user_id: 'user-3',
      }),
    ).rejects.toThrow(ServiceUnavailableException);

    expect(queryBuilder.update).not.toHaveBeenCalled();
    expect(centrifugo.publish).not.toHaveBeenCalled();
  });
});
