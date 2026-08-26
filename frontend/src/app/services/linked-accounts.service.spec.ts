import { TestBed } from '@angular/core/testing';
import type { UserIdentity } from '@supabase/supabase-js';
import { LinkedAccountsService } from './linked-accounts.service';
import { SupabaseService } from './supabase.service';

const identity = (provider: string, identityId: string): UserIdentity =>
  ({
    id: identityId,
    identity_id: identityId,
    user_id: 'user-1',
    identity_data: { email: `${provider}@example.test` },
    provider,
    created_at: '2026-08-22T00:00:00Z',
    updated_at: '2026-08-22T00:00:00Z',
    last_sign_in_at: '2026-08-22T00:00:00Z',
  }) as UserIdentity;

describe('LinkedAccountsService', () => {
  let service: LinkedAccountsService;
  let auth: {
    getUserIdentities: ReturnType<typeof vi.fn>;
    linkIdentity: ReturnType<typeof vi.fn>;
    unlinkIdentity: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    auth = {
      getUserIdentities: vi.fn().mockResolvedValue({
        data: { identities: [identity('email', 'email-1'), identity('google', 'google-1')] },
        error: null,
      }),
      linkIdentity: vi.fn().mockResolvedValue({ data: {}, error: null }),
      unlinkIdentity: vi.fn().mockResolvedValue({ data: {}, error: null }),
    };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ auth }) },
        },
      ],
    });

    service = TestBed.inject(LinkedAccountsService);
  });

  it('loads only supported identities from the authenticated Supabase user', async () => {
    auth.getUserIdentities.mockResolvedValue({
      data: {
        identities: [
          identity('email', 'email-1'),
          identity('google', 'google-1'),
          identity('github', 'github-1'),
        ],
      },
      error: null,
    });

    await expect(service.getLinkedAccounts()).resolves.toEqual([
      expect.objectContaining({ provider: 'email', active: true, identity_id: 'email-1' }),
      expect.objectContaining({ provider: 'google', active: true, identity_id: 'google-1' }),
    ]);
  });

  it('fails closed when Supabase cannot load identity state', async () => {
    auth.getUserIdentities.mockResolvedValue({ data: null, error: { message: 'provider outage' } });

    await expect(service.getLinkedAccounts()).rejects.toThrow('Unable to load linked accounts');
  });

  it('starts the real Supabase manual-linking flow for Google', async () => {
    auth.getUserIdentities.mockResolvedValue({ data: { identities: [identity('email', 'email-1')] }, error: null });

    await service.linkAccount('google');

    expect(auth.linkIdentity).toHaveBeenCalledTimes(1);
    expect(auth.linkIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' }),
    );
  });

  it('does not start OAuth when the requested identity is already linked', async () => {
    await service.linkAccount('google');

    expect(auth.linkIdentity).not.toHaveBeenCalled();
  });

  it('rejects unsupported providers before starting an OAuth flow', async () => {
    await expect(service.linkAccount('facebook' as never)).rejects.toThrow(
      'Unsupported linked account provider',
    );

    expect(auth.linkIdentity).not.toHaveBeenCalled();
  });

  it('unlinks the exact authenticated identity when another sign-in method remains', async () => {
    await service.unlinkAccount('google');

    expect(auth.unlinkIdentity).toHaveBeenCalledTimes(1);
    expect(auth.unlinkIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google', identity_id: 'google-1' }),
    );
  });

  it('refuses to unlink the last remaining sign-in identity', async () => {
    auth.getUserIdentities.mockResolvedValue({
      data: { identities: [identity('google', 'google-1')] },
      error: null,
    });

    await expect(service.unlinkAccount('google')).rejects.toThrow(
      'Cannot unlink the last sign-in method',
    );
    expect(auth.unlinkIdentity).not.toHaveBeenCalled();
  });

  it('serializes concurrent mutations so repeated clicks cannot duplicate linking', async () => {
    auth.getUserIdentities.mockResolvedValue({ data: { identities: [identity('email', 'email-1')] }, error: null });
    let resolveLink!: () => void;
    auth.linkIdentity.mockReturnValue(
      new Promise((resolve) => {
        resolveLink = () => resolve({ data: {}, error: null });
      }),
    );

    const first = service.linkAccount('apple');
    const second = service.linkAccount('apple');
    await Promise.resolve();
    expect(auth.linkIdentity).toHaveBeenCalledTimes(1);

    resolveLink();
    await Promise.all([first, second]);
    expect(auth.linkIdentity).toHaveBeenCalledTimes(1);
  });
});
