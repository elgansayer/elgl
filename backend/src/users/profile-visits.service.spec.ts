import {
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ProfileVisitsService } from './profile-visits.service';

describe('ProfileVisitsService', () => {
  let service: ProfileVisitsService;
  let supabaseClient: any;
  let privacyQuery: any;
  let visitsQuery: any;

  beforeEach(() => {
    privacyQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { incognito_visits: false },
        error: null,
      }),
    };
    visitsQuery = {
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    supabaseClient = {
      from: vi
        .fn()
        .mockImplementation((table: string) =>
          table === 'users' ? privacyQuery : visitsQuery,
        ),
    };
    service = new ProfileVisitsService({
      getClient: vi.fn().mockReturnValue(supabaseClient),
    } as any);
  });

  it('records a visit when the viewer is not incognito', async () => {
    await expect(service.recordVisit('viewer-1', 'profile-1')).resolves.toBe(
      true,
    );

    expect(privacyQuery.eq).toHaveBeenCalledWith('id', 'viewer-1');
    expect(visitsQuery.insert).toHaveBeenCalledWith({
      visitor_id: 'viewer-1',
      viewed_id: 'profile-1',
    });
  });

  it('does not record self visits', async () => {
    await expect(service.recordVisit('user-1', 'user-1')).resolves.toBe(false);
    expect(supabaseClient.from).not.toHaveBeenCalled();
  });

  it('does not record incognito visits', async () => {
    privacyQuery.maybeSingle.mockResolvedValue({
      data: { incognito_visits: true },
      error: null,
    });

    await expect(service.recordVisit('viewer-1', 'profile-1')).resolves.toBe(
      false,
    );
    expect(visitsQuery.insert).not.toHaveBeenCalled();
  });

  it('fails closed when visitor privacy state cannot be loaded', async () => {
    privacyQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });

    await expect(service.recordVisit('viewer-1', 'profile-1')).resolves.toBe(
      false,
    );
    expect(visitsQuery.insert).not.toHaveBeenCalled();
  });

  it('keeps profile reads usable when visit persistence fails', async () => {
    visitsQuery.insert.mockResolvedValue({
      error: { message: 'insert failed' },
    });

    await expect(service.recordVisit('viewer-1', 'profile-1')).resolves.toBe(
      false,
    );
  });

  it('only exposes visitor history to the profile owner', async () => {
    await expect(
      service.getVisitors('profile-1', 'other-user'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(supabaseClient.from).not.toHaveBeenCalled();
  });

  it('returns visitor rows newest-first with bounded pagination', async () => {
    visitsQuery.range.mockResolvedValue({
      data: [
        {
          id: 'visit-1',
          visitor_id: 'viewer-1',
          viewed_id: 'profile-1',
          created_at: '2026-08-20T10:00:00.000Z',
          visitor: {
            id: 'viewer-1',
            display_name: 'Viewer One',
            avatar_url: null,
            native_languages: ['en'],
            target_languages: ['ja'],
          },
        },
      ],
      error: null,
    });

    const result = await service.getVisitors('profile-1', 'profile-1', 250, 3);

    expect(visitsQuery.eq).toHaveBeenCalledWith('viewed_id', 'profile-1');
    expect(visitsQuery.order).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
    expect(visitsQuery.range).toHaveBeenCalledWith(3, 102);
    expect(result).toEqual([
      {
        id: 'visit-1',
        visitor_id: 'viewer-1',
        viewed_id: 'profile-1',
        created_at: '2026-08-20T10:00:00.000Z',
        visitor: {
          id: 'viewer-1',
          display_name: 'Viewer One',
          avatar_url: '',
          native_languages: ['en'],
          target_languages: ['ja'],
        },
      },
    ]);
  });

  it('surfaces visitor query failures without fabricating data', async () => {
    visitsQuery.range.mockResolvedValue({
      data: null,
      error: { message: 'query failed' },
    });

    await expect(
      service.getVisitors('profile-1', 'profile-1'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
