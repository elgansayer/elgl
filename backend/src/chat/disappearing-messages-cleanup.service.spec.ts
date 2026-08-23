import { Test, TestingModule } from '@nestjs/testing';
import { DisappearingMessagesCleanupService } from './disappearing-messages-cleanup.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from './centrifugo.service';

describe('DisappearingMessagesCleanupService', () => {
  let service: DisappearingMessagesCleanupService;
  const rpc = vi.fn();
  const publish = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DisappearingMessagesCleanupService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ rpc }) },
        },
        {
          provide: CentrifugoService,
          useValue: { publish },
        },
      ],
    }).compile();

    service = moduleRef.get(DisappearingMessagesCleanupService);
  });

  it('purges a bounded batch and broadcasts existing delete events', async () => {
    rpc.mockResolvedValue({
      data: [
        { message_id: 'message-1', room_id: 'room-1' },
        { message_id: 'message-2', room_id: 'room-2' },
      ],
      error: null,
    });
    publish.mockResolvedValue(undefined);

    await expect(service.purgeExpiredMessages()).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('purge_expired_chat_messages', {
      p_limit: 500,
    });
    expect(publish).toHaveBeenCalledWith('chat:room-1', {
      type: 'message_deleted',
      deleted_for: 'everyone',
      message_id: 'message-1',
      reason: 'expired',
    });
    expect(publish).toHaveBeenCalledWith('chat:room-2', {
      type: 'message_deleted',
      deleted_for: 'everyone',
      message_id: 'message-2',
      reason: 'expired',
    });
  });

  it('accepts an empty cleanup batch without realtime work', async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    await expect(service.purgeExpiredMessages()).resolves.toBeUndefined();
    expect(publish).not.toHaveBeenCalled();
  });

  it('contains database failures so the scheduler can retry next minute', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '08006', message: 'connection failed' },
    });

    await expect(service.purgeExpiredMessages()).resolves.toBeUndefined();
    expect(publish).not.toHaveBeenCalled();
  });

  it('does not let a realtime provider failure abort physical cleanup', async () => {
    rpc.mockResolvedValue({
      data: [
        { message_id: 'message-1', room_id: 'room-1' },
        { message_id: 'message-2', room_id: 'room-2' },
      ],
      error: null,
    });
    publish.mockRejectedValueOnce(new Error('realtime unavailable')).mockResolvedValueOnce(undefined);

    await expect(service.purgeExpiredMessages()).resolves.toBeUndefined();
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('ignores malformed RPC identities instead of publishing untrusted channels', async () => {
    rpc.mockResolvedValue({
      data: [
        { message_id: '', room_id: 'room-1' },
        { message_id: 'message-1', room_id: 42 },
        null,
      ],
      error: null,
    });

    await expect(service.purgeExpiredMessages()).resolves.toBeUndefined();
    expect(publish).not.toHaveBeenCalled();
  });
});
