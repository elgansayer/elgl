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
});
