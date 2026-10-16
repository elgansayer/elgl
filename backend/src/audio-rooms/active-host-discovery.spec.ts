/// <reference types="vi" />
import { AudioRoomsService } from './audio-rooms.service';

describe('AudioRoomsService active host discovery', () => {
  const createHarness = (response: {
    data: Array<{ host_id: string; is_private?: boolean }> | null;
    error: unknown;
  }) => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockResolvedValue(response);

    const client = {
      from: vi.fn().mockReturnValue(query),
    };
    const warn = vi.fn();

    const service = Object.create(
      AudioRoomsService.prototype,
    ) as AudioRoomsService;
    Object.assign(service as unknown as Record<string, unknown>, {
      supabaseService: {
        getClient: vi.fn().mockReturnValue(client),
      },
      logger: { warn },
    });

    return { service, client, query, warn };
  };

  it('returns unique hosts for public active rooms only', async () => {
    const { service, client, query } = createHarness({
      data: [
        { host_id: 'public-a', is_private: false },
        { host_id: 'public-a', is_private: false },
        { host_id: 'private-b', is_private: true },
        { host_id: 'legacy-public-c' },
      ],
      error: null,
    });

    await expect(service.getActiveHostIds()).resolves.toEqual([
      'public-a',
      'legacy-public-c',
    ]);
    expect(client.from).toHaveBeenCalledWith('audio_rooms');
    expect(query.select).toHaveBeenCalledWith('host_id, is_private');
    expect(query.eq).toHaveBeenCalledWith('is_active', true);
  });

  it('fails closed to no discoverable hosts when the room query fails', async () => {
    const { service, warn } = createHarness({
      data: null,
      error: { code: 'provider_unavailable' },
    });

    await expect(service.getActiveHostIds()).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('treats a missing provider payload as no discoverable hosts', async () => {
    const { service } = createHarness({ data: null, error: null });

    await expect(service.getActiveHostIds()).resolves.toEqual([]);
  });
});
