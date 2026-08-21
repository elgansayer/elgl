import { NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminUserDetailService } from './admin-user-detail.service';

describe('AdminUserDetailService', () => {
  it('returns only the bounded administrative user summary contract', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'user-1',
        display_name: 'Test User',
        avatar_url: null,
        native_languages: ['en'],
        target_languages: ['ja'],
        is_vip: false,
        vip_tier: 'free',
        is_admin: false,
        coins_balance: 10,
        study_streak_days: 3,
        last_active_at: '2026-08-15T20:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const service = new AdminUserDetailService({
      getClient: vi.fn().mockReturnValue({ from }),
    } as unknown as SupabaseService);

    await expect(service.getUser('user-1')).resolves.toMatchObject({
      id: 'user-1',
      display_name: 'Test User',
    });
    expect(from).toHaveBeenCalledWith('users');
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
    expect(select).toHaveBeenCalledTimes(1);
    expect(String(select.mock.calls[0]?.[0])).not.toContain('email');
  });

  it('returns a stable not-found error when the user cannot be loaded', async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: null, error: new Error('missing') });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const service = new AdminUserDetailService({
      getClient: vi.fn().mockReturnValue({ from }),
    } as unknown as SupabaseService);

    await expect(service.getUser('missing-user')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
