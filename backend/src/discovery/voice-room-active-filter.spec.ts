/// <reference types="vi" />
import { DiscoveryService } from './discovery.service';
import { UserProfile } from '../users/interfaces/user-profile.interface';

describe('DiscoveryService voice room active filter', () => {
  const makeUser = (id: string): UserProfile =>
    ({
      id,
      display_name: `User ${id}`,
      native_languages: ['en'],
      target_languages: ['ja'],
    }) as UserProfile;

  const createHarness = () => {
    const getActiveHostIds = vi.fn<() => Promise<string[]>>();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
    };

    const service = new DiscoveryService(
      logger as never,
      { getActiveHostIds } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const filter = (users: UserProfile[], active: boolean) =>
      (
        service as unknown as {
          filterByVoiceRoomActive(
            candidates: UserProfile[],
            voiceRoomActive: boolean,
          ): Promise<UserProfile[]>;
        }
      ).filterByVoiceRoomActive(users, active);

    return { service, filter, getActiveHostIds, logger };
  };

  it('does not query audio rooms when the filter is disabled', async () => {
    const { filter, getActiveHostIds } = createHarness();
    const candidates = [makeUser('a'), makeUser('b')];

    await expect(filter(candidates, false)).resolves.toBe(candidates);
    expect(getActiveHostIds).not.toHaveBeenCalled();
  });

  it('returns only users hosting an active public audio room', async () => {
    const { filter, getActiveHostIds } = createHarness();
    getActiveHostIds.mockResolvedValue(['host-b', 'host-d']);

    const result = await filter(
      [makeUser('host-a'), makeUser('host-b'), makeUser('host-c')],
      true,
    );

    expect(result.map((candidate) => candidate.id)).toEqual(['host-b']);
    expect(getActiveHostIds).toHaveBeenCalledTimes(1);
  });

  it('returns an empty result when there are no active public hosts', async () => {
    const { filter, getActiveHostIds } = createHarness();
    getActiveHostIds.mockResolvedValue([]);

    await expect(filter([makeUser('host-a')], true)).resolves.toEqual([]);
  });

  it('preserves ordinary discovery if the audio-room provider unexpectedly throws', async () => {
    const { filter, getActiveHostIds, logger } = createHarness();
    const candidates = [makeUser('host-a'), makeUser('host-b')];
    getActiveHostIds.mockRejectedValue(new Error('provider unavailable'));

    await expect(filter(candidates, true)).resolves.toBe(candidates);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
