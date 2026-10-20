import { firstValueFrom, of } from 'rxjs';
import { ServiceUnavailableException } from '@nestjs/common';
import { LegacyProfileVisitorsPrivacyInterceptor } from './legacy-profile-visitors-privacy.interceptor';
import { SupabaseService } from '../../supabase/supabase.service';

describe('LegacyProfileVisitorsPrivacyInterceptor', () => {
  const legacyPayload = [
    {
      id: 'visit-1',
      visitor_id: 'visitor-1',
      viewed_id: 'owner-1',
      created_at: '2026-08-20T12:00:00.000Z',
      visitor: {
        id: 'visitor-1',
        display_name: 'Secret Visitor',
        avatar_url: 'secret.png',
        native_languages: ['en'],
        target_languages: ['ja'],
      },
    },
  ];

  function setup(entitlement: { data: unknown; error: unknown }) {
    const single = vi.fn().mockResolvedValue(entitlement);
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single,
    };
    const supabase = { from: vi.fn().mockReturnValue(query) };
    const interceptor = new LegacyProfileVisitorsPrivacyInterceptor({
      getClient: () => supabase,
    } as unknown as SupabaseService);
    const headers = new Map<string, string>();
    const request = {
      method: 'GET',
      path: '/users/me/visitors',
      route: { path: 'me/visitors' },
      user: { id: 'owner-1' },
    };
    const response = {
      setHeader: vi.fn((name: string, value: string) =>
        headers.set(name, value),
      ),
    };
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as any;
    const next = { handle: vi.fn(() => of(legacyPayload)) } as any;

    return { interceptor, context, next, headers };
  }

  it('masks identities for non-VIP callers of the deprecated endpoint', async () => {
    const { interceptor, context, next, headers } = setup({
      data: {
        is_vip: false,
        is_deleted: false,
        scheduled_for_deletion_at: null,
      },
      error: null,
    });

    const result = await firstValueFrom(interceptor.intercept(context, next));

    expect(result).toEqual([
      {
        id: 'visit-1',
        visitor_id: 'hidden-vip-only',
        viewed_id: 'owner-1',
        created_at: '2026-08-20T12:00:00.000Z',
        visitor: {
          id: 'hidden-vip-only',
          display_name: 'Someone viewed your profile',
          avatar_url: '',
          native_languages: [],
          target_languages: [],
        },
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('Secret Visitor');
    expect(headers.get('Deprecation')).toBe('true');
    expect(headers.get('Link')).toContain('/profile-visits/my-visitors');
  });

  it('preserves identities only for a server-verified VIP caller', async () => {
    const { interceptor, context, next } = setup({
      data: {
        is_vip: true,
        is_deleted: false,
        scheduled_for_deletion_at: null,
      },
      error: null,
    });

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).resolves.toEqual(legacyPayload);
  });

  it('fails closed when entitlement cannot be verified', async () => {
    const { interceptor, context, next } = setup({
      data: null,
      error: { message: 'database unavailable' },
    });

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('does not alter unrelated routes', async () => {
    const { interceptor, context, next } = setup({
      data: { is_vip: false },
      error: null,
    });
    const request = context.switchToHttp().getRequest();
    request.path = '/users/me';
    request.route.path = 'me';

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).resolves.toEqual(legacyPayload);
  });

  it('protects the deprecated endpoint when the application prefix is present', async () => {
    const { interceptor, context, next } = setup({
      data: {
        is_vip: false,
        is_deleted: false,
        scheduled_for_deletion_at: null,
      },
      error: null,
    });
    context.switchToHttp().getRequest().path = '/api/users/me/visitors';

    const result = await firstValueFrom(interceptor.intercept(context, next));

    expect(JSON.stringify(result)).not.toContain('Secret Visitor');
  });
});
