import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MomentLikesService } from './moment-likes.service';

describe('MomentLikesService', () => {
  const momentSingle = vi.fn();
  const momentEq = vi.fn(() => ({ single: momentSingle }));
  const momentSelect = vi.fn(() => ({ eq: momentEq }));

  const likesReturns = vi.fn();
  const likesRange = vi.fn(() => ({ returns: likesReturns }));
  const likesOrder = vi.fn(() => ({ range: likesRange }));
  const likesNot = vi.fn(() => ({ order: likesOrder }));
  const likesEq = vi.fn(() => ({ not: likesNot, order: likesOrder }));
  const likesSelect = vi.fn(() => ({ eq: likesEq }));

  const from = vi.fn((table: string) => {
    if (table === 'moments') {
      return { select: momentSelect };
    }
    if (table === 'moment_likes') {
      return { select: likesSelect };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  const getBlockedAndBlockerIds = vi.fn();
  const service = new MomentLikesService(
    { getClient: () => ({ from }) } as never,
    { getBlockedAndBlockerIds } as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    momentSingle.mockResolvedValue({
      data: { user_id: 'author-1' },
      error: null,
    });
    getBlockedAndBlockerIds.mockResolvedValue([]);
    likesReturns.mockResolvedValue({ data: [], error: null });
  });

  it('returns newest liker profiles from the requested bounded range', async () => {
    likesReturns.mockResolvedValue({
      data: [
        {
          user_id: 'user-2',
          created_at: '2026-08-21T10:00:00.000Z',
          users: {
            id: 'user-2',
            display_name: 'Alice',
            avatar_url: null,
            native_languages: ['en'],
            target_languages: ['ja'],
          },
        },
      ],
      error: null,
    });

    const result = await service.listMomentLikes('moment-1', 'viewer-1', {
      offset: 50,
      limit: 25,
    });

    expect(result).toEqual([
      expect.objectContaining({ id: 'user-2', display_name: 'Alice' }),
    ]);
    expect(momentEq).toHaveBeenCalledWith('id', 'moment-1');
    expect(likesEq).toHaveBeenCalledWith('moment_id', 'moment-1');
    expect(likesOrder).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
    expect(likesRange).toHaveBeenCalledWith(50, 74);
  });

  it('filters blocked liker profiles without leaking them to the viewer', async () => {
    getBlockedAndBlockerIds.mockResolvedValue(['blocked-user']);
    likesReturns.mockResolvedValue({
      data: [
        {
          user_id: 'blocked-user',
          created_at: '2026-08-21T10:00:00.000Z',
          users: {
            id: 'blocked-user',
            display_name: 'Blocked',
            avatar_url: null,
            target_languages: ['en'],
          },
        },
        {
          user_id: 'visible-user',
          created_at: '2026-08-21T09:00:00.000Z',
          users: {
            id: 'visible-user',
            display_name: 'Visible',
            avatar_url: null,
            target_languages: ['fr'],
          },
        },
      ],
      error: null,
    });

    await expect(
      service.listMomentLikes('moment-1', 'viewer-1'),
    ).resolves.toEqual([expect.objectContaining({ id: 'visible-user' })]);
    expect(likesNot).toHaveBeenCalledWith('user_id', 'in', '(blocked-user)');
  });

  it('fails closed when the viewer and Moment author are blocked', async () => {
    getBlockedAndBlockerIds.mockResolvedValue(['author-1']);

    await expect(
      service.listMomentLikes('moment-1', 'viewer-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(likesSelect).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing Moment before querying its social graph', async () => {
    momentSingle.mockResolvedValue({
      data: null,
      error: { message: 'missing' },
    });

    await expect(
      service.listMomentLikes('missing-moment', 'viewer-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(getBlockedAndBlockerIds).not.toHaveBeenCalled();
    expect(likesSelect).not.toHaveBeenCalled();
  });

  it.each([
    [{ offset: -1, limit: 10 }],
    [{ offset: 10_001, limit: 10 }],
    [{ offset: 0, limit: 0 }],
    [{ offset: 0, limit: 51 }],
    [{ offset: Number.NaN, limit: 10 }],
  ])('rejects invalid pagination %o', async (options) => {
    await expect(
      service.listMomentLikes('moment-1', 'viewer-1', options),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(from).not.toHaveBeenCalled();
  });

  it('does not expose database/provider details when the likes query fails', async () => {
    likesReturns.mockResolvedValue({
      data: null,
      error: { message: 'postgres://secret-host/private-table' },
    });

    await expect(
      service.listMomentLikes('moment-1', 'viewer-1'),
    ).rejects.toThrow('Failed to fetch Moment likes.');
  });
});
