import { describe, expect, it, vi } from 'vitest';
import { SystemMessageService } from './system-message.service';

describe('SystemMessageService hardening', () => {
  function createService(options?: {
    memberships?: Array<{ room_id: string }>;
    membershipError?: { message: string } | null;
    publish?: ReturnType<typeof vi.fn>;
  }) {
    const publish = options?.publish ?? vi.fn().mockResolvedValue(true);
    const memberships = options?.memberships ?? [];
    const membershipError = options?.membershipError ?? null;

    const eq = vi.fn().mockResolvedValue({
      data: memberships,
      error: membershipError,
    });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const supabaseService = {
      getClient: vi.fn().mockReturnValue({ from }),
    };

    const service = new SystemMessageService(
      { publish } as never,
      supabaseService as never,
    );

    return { service, publish, supabaseService };
  }

  it('keeps the backend event type authoritative and bounds scalar params', async () => {
    const { service, publish } = createService();

    await service.publishToRoom('room-1', 'memberAdded', {
      type: 'announcement',
      count: 2,
      message: 'x'.repeat(600),
      nested: { unsafe: true },
      infinite: Number.POSITIVE_INFINITY,
    });

    expect(publish).toHaveBeenCalledTimes(1);
    const payload = publish.mock.calls[0]?.[1] as {
      message: {
        system_event: Record<string, unknown>;
      };
    };

    expect(payload.message.system_event['type']).toBe('memberAdded');
    expect(payload.message.system_event['count']).toBe(2);
    expect(String(payload.message.system_event['message'])).toHaveLength(500);
    expect(payload.message.system_event['nested']).toBeUndefined();
    expect(payload.message.system_event['infinite']).toBeUndefined();
  });

  it('rejects malformed event types before publishing', async () => {
    const { service, publish } = createService();

    await expect(
      service.publishToRoom('room-1', 'system.<script>', {}),
    ).rejects.toThrow('Invalid system event type');
    expect(publish).not.toHaveBeenCalled();
  });

  it('deduplicates room fan-out and isolates individual publish failures', async () => {
    const publish = vi.fn().mockImplementation((channel: string) => {
      if (channel === 'chat:room-b') {
        return Promise.reject(new Error('centrifugo unavailable'));
      }
      return Promise.resolve(true);
    });
    const { service } = createService({
      publish,
      memberships: [
        { room_id: 'room-a' },
        { room_id: 'room-a' },
        { room_id: 'room-b' },
      ],
    });

    await expect(
      service.publishToAllUserRooms('user-1', 'profileUpdated', {
        name: 'Partner',
      }),
    ).resolves.toBeUndefined();

    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith(
      'chat:room-a',
      expect.objectContaining({ message: expect.any(Object) }),
    );
    expect(publish).toHaveBeenCalledWith(
      'chat:room-b',
      expect.objectContaining({ message: expect.any(Object) }),
    );
  });

  it('fails closed when room membership lookup fails', async () => {
    const { service, publish } = createService({
      membershipError: { message: 'database unavailable' },
    });

    await expect(
      service.publishToAllUserRooms('user-1', 'profileUpdated'),
    ).resolves.toBeUndefined();
    expect(publish).not.toHaveBeenCalled();
  });
});
