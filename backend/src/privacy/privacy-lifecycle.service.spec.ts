import { ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PrivacyLifecycleService } from './privacy-lifecycle.service';

describe('PrivacyLifecycleService', () => {
  const maybeSingle = vi.fn();
  const eq = vi.fn();
  const select = vi.fn();
  const from = vi.fn();
  let service: PrivacyLifecycleService;

  beforeEach(() => {
    vi.clearAllMocks();

    const query = {
      select,
      eq,
      maybeSingle,
    };
    select.mockReturnValue(query);
    eq.mockReturnValue(query);
    from.mockReturnValue(query);

    const client = { from };
    service = new PrivacyLifecycleService({
      getClient: () => client,
    } as unknown as SupabaseService);
  });

  it('returns the authenticated account deletion state', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        is_deletion_pending: true,
        scheduled_for_deletion_at: '2026-09-26T04:00:00Z',
        deletion_requested_at: '2026-08-27T04:00:00Z',
      },
      error: null,
    });

    await expect(service.getAccountDeletionStatus('user-1')).resolves.toEqual({
      pending: true,
      scheduled_for: '2026-09-26T04:00:00.000Z',
      requested_at: '2026-08-27T04:00:00.000Z',
    });

    expect(from).toHaveBeenCalledWith('users');
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('does not expose stale timestamps after deletion was cancelled', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        is_deletion_pending: false,
        scheduled_for_deletion_at: '2026-09-26T04:00:00Z',
        deletion_requested_at: '2026-08-27T04:00:00Z',
      },
      error: null,
    });

    await expect(service.getAccountDeletionStatus('user-1')).resolves.toEqual({
      pending: false,
      scheduled_for: null,
      requested_at: null,
    });
  });

  it('preserves pending state when a legacy timestamp is malformed', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        is_deletion_pending: true,
        scheduled_for_deletion_at: 'not-a-date',
        deletion_requested_at: null,
      },
      error: null,
    });

    await expect(service.getAccountDeletionStatus('user-1')).resolves.toEqual({
      pending: true,
      scheduled_for: null,
      requested_at: null,
    });
  });

  it('fails closed when the profile cannot be read', async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'provider detail' },
    });

    await expect(service.getAccountDeletionStatus('user-1')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('fails closed when the authenticated profile is missing', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(service.getAccountDeletionStatus('user-1')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
