import { SupabaseService } from '../supabase/supabase.service';
import { AdminRoleAssignmentsService } from './admin-role-assignments.service';

describe('AdminRoleAssignmentsService', () => {
  it('maps bounded assignments to role metadata', async () => {
    const range = vi.fn().mockResolvedValue({
      data: [
        {
          user_id: 'user-1',
          role_id: 'role-1',
          granted_by: 'admin-1',
          granted_at: '2026-08-15T20:00:00.000Z',
          expires_at: null,
        },
      ],
      error: null,
      count: 1,
    });
    const order = vi.fn().mockReturnValue({ range });
    const assignmentSelect = vi.fn().mockReturnValue({ order });
    const roleIn = vi.fn().mockResolvedValue({
      data: [{ id: 'role-1', key: 'support', name: 'Support' }],
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === 'admin_user_roles') return { select: assignmentSelect };
      if (table === 'admin_roles') {
        return { select: vi.fn().mockReturnValue({ in: roleIn }) };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const service = new AdminRoleAssignmentsService({
      getClient: vi.fn().mockReturnValue({ from }),
    } as unknown as SupabaseService);

    await expect(service.list({ page: 1, pageSize: 50 })).resolves.toEqual({
      assignments: [
        expect.objectContaining({
          userId: 'user-1',
          roleKey: 'support',
          roleName: 'Support',
          active: true,
        }),
      ],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    expect(range).toHaveBeenCalledWith(0, 49);
  });

  it('filters assignments by exact granting administrator', async () => {
    const range = vi
      .fn()
      .mockResolvedValue({ data: [], error: null, count: 0 });
    const order = vi.fn().mockReturnValue({ range });
    const eqGrantedBy = vi.fn().mockReturnValue({ order });
    const assignmentSelect = vi
      .fn()
      .mockReturnValue({ eq: eqGrantedBy, order });
    const service = new AdminRoleAssignmentsService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ select: assignmentSelect }),
      }),
    } as unknown as SupabaseService);

    await expect(
      service.list({ page: 1, pageSize: 50, grantedBy: 'admin-2' }),
    ).resolves.toEqual({
      assignments: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });
    expect(eqGrantedBy).toHaveBeenCalledWith('granted_by', 'admin-2');
  });

  it('filters assignments by inclusive grant-time bounds', async () => {
    const range = vi
      .fn()
      .mockResolvedValue({ data: [], error: null, count: 0 });
    const order = vi.fn().mockReturnValue({ range });
    const lte = vi.fn().mockReturnValue({ order });
    const gte = vi.fn().mockReturnValue({ lte });
    const assignmentSelect = vi.fn().mockReturnValue({ gte, order });
    const service = new AdminRoleAssignmentsService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ select: assignmentSelect }),
      }),
    } as unknown as SupabaseService);

    await service.list({
      startTime: '2026-08-15T20:00:00.000Z',
      endTime: '2026-08-15T21:00:00.000Z',
    });

    expect(gte).toHaveBeenCalledWith('granted_at', '2026-08-15T20:00:00.000Z');
    expect(lte).toHaveBeenCalledWith('granted_at', '2026-08-15T21:00:00.000Z');
  });

  it('rejects inverted grant-time bounds before querying storage', async () => {
    const from = vi.fn();
    const service = new AdminRoleAssignmentsService({
      getClient: vi.fn().mockReturnValue({ from }),
    } as unknown as SupabaseService);

    await expect(
      service.list({
        startTime: '2026-08-15T22:00:00.000Z',
        endTime: '2026-08-15T21:00:00.000Z',
      }),
    ).rejects.toThrow('startTime must be before or equal to endTime');
    expect(from).not.toHaveBeenCalled();
  });
});
