import { SupabaseService } from '../supabase/supabase.service';
import { AdminAuthorizationService } from './admin-authorization.service';

interface QueryBuilder {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
}

describe('AdminAuthorizationService', () => {
  let service: AdminAuthorizationService;
  let assignments: QueryBuilder;
  let capabilities: QueryBuilder;

  beforeEach(() => {
    assignments = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn(),
      in: vi.fn(),
    };
    capabilities = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn(),
      or: vi.fn(),
      in: vi.fn(),
    };

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'admin_user_roles') return assignments;
        if (table === 'admin_role_capabilities') return capabilities;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    service = new AdminAuthorizationService({
      getClient: vi.fn().mockReturnValue(client),
    } as unknown as SupabaseService);
  });

  it('returns an empty capability set when the user has no active roles', async () => {
    assignments.or.mockResolvedValue({ data: [], error: null });

    await expect(service.getEffectiveCapabilities('user-1')).resolves.toEqual(
      [],
    );
    expect(capabilities.select).not.toHaveBeenCalled();
  });

  it('always scopes role assignments to the user and unexpired roles', async () => {
    assignments.or.mockResolvedValue({ data: [], error: null });

    await service.getEffectiveCapabilities('admin-1');

    expect(assignments.eq).toHaveBeenCalledWith('user_id', 'admin-1');
    expect(assignments.or).toHaveBeenCalledOnce();
    const expiryFilter = assignments.or.mock.calls[0]?.[0];
    expect(expiryFilter).toEqual(expect.any(String));
    expect(expiryFilter).toMatch(
      /^expires_at\.is\.null,expires_at\.gt\.\d{4}-\d{2}-\d{2}T/,
    );
  });

  it('returns unique registered capabilities from active role assignments', async () => {
    assignments.or.mockResolvedValue({
      data: [
        { role_id: 'role-1', expires_at: null },
        { role_id: 'role-2', expires_at: '2099-01-01T00:00:00.000Z' },
      ],
      error: null,
    });
    capabilities.in.mockResolvedValue({
      data: [
        { capability_key: 'users.manage' },
        { capability_key: 'users.read' },
        { capability_key: 'users.read' },
        { capability_key: 'unknown.capability' },
      ],
      error: null,
    });

    await expect(service.getEffectiveCapabilities('admin-1')).resolves.toEqual([
      'users.manage',
      'users.read',
    ]);
    expect(capabilities.in).toHaveBeenCalledWith('role_id', [
      'role-1',
      'role-2',
    ]);
  });

  it('fails closed when role assignment lookup fails', async () => {
    const error = new Error('role lookup failed');
    assignments.or.mockResolvedValue({ data: null, error });

    await expect(service.getEffectiveCapabilities('admin-1')).rejects.toBe(
      error,
    );
  });

  it('fails closed when capability lookup fails', async () => {
    assignments.or.mockResolvedValue({
      data: [{ role_id: 'role-1', expires_at: null }],
      error: null,
    });
    const error = new Error('capability lookup failed');
    capabilities.in.mockResolvedValue({ data: null, error });

    await expect(service.getEffectiveCapabilities('admin-1')).rejects.toBe(
      error,
    );
  });

  it('checks that all required capabilities are present', async () => {
    assignments.or.mockResolvedValue({
      data: [{ role_id: 'role-1', expires_at: null }],
      error: null,
    });
    capabilities.in.mockResolvedValue({
      data: [
        { capability_key: 'users.read' },
        { capability_key: 'users.manage' },
      ],
      error: null,
    });

    await expect(
      service.hasAllCapabilities('admin-1', ['users.read', 'users.manage']),
    ).resolves.toBe(true);
    await expect(
      service.hasAllCapabilities('admin-1', ['audit.read']),
    ).resolves.toBe(false);
  });
});
