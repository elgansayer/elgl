import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LinkedAccountsService } from './linked-accounts.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('LinkedAccountsService', () => {
  let service: LinkedAccountsService;
  let getUserById: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getUserById = vi.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkedAccountsService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({ auth: { admin: { getUserById } } }),
          },
        },
      ],
    }).compile();

    service = module.get<LinkedAccountsService>(LinkedAccountsService);
  });

  it('returns supported identities from the authoritative Supabase Auth user', async () => {
    getUserById.mockResolvedValue({
      data: {
        user: {
          identities: [
            {
              identity_id: 'email-1',
              provider: 'email',
              identity_data: { email: 'learner@example.test' },
              created_at: '2026-08-20T10:00:00Z',
            },
            {
              identity_id: 'google-1',
              provider: 'google',
              identity_data: { email: 'google@example.test' },
              created_at: '2026-08-21T10:00:00Z',
            },
            {
              identity_id: 'github-1',
              provider: 'github',
              identity_data: {},
              created_at: '2026-08-22T10:00:00Z',
            },
          ],
        },
      },
      error: null,
    });

    await expect(service.getLinkedAccounts('user-1')).resolves.toEqual([
      {
        provider: 'email',
        active: true,
        identity_id: 'email-1',
        created_at: '2026-08-20T10:00:00Z',
        name: 'learner@example.test',
      },
      {
        provider: 'google',
        active: true,
        identity_id: 'google-1',
        created_at: '2026-08-21T10:00:00Z',
        name: 'google@example.test',
      },
    ]);
    expect(getUserById).toHaveBeenCalledWith('user-1');
  });

  it('bounds display metadata returned from identity data', async () => {
    getUserById.mockResolvedValue({
      data: {
        user: {
          identities: [
            {
              identity_id: 'apple-1',
              provider: 'apple',
              identity_data: { full_name: `  ${'a'.repeat(400)}  ` },
            },
          ],
        },
      },
      error: null,
    });

    const [account] = await service.getLinkedAccounts('user-1');
    expect(account.name).toHaveLength(200);
  });

  it('fails closed instead of returning mock or empty identity state on provider failure', async () => {
    getUserById.mockResolvedValue({
      data: { user: null },
      error: { message: 'provider unavailable', status: 503 },
    });

    await expect(service.getLinkedAccounts('user-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
