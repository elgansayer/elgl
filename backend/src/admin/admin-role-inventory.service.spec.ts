import { SupabaseService } from '../supabase/supabase.service';
import { AdminRoleInventoryService } from './admin-role-inventory.service';

describe('AdminRoleInventoryService', () => {
  it('returns roles with sorted capability assignments', async () => {
    const rolesOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'role-1',
          key: 'support',
          name: 'Support',
          description: 'Support operators',
          is_system: false,
          created_at: '2026-08-15T20:00:00.000Z',
          updated_at: '2026-08-15T20:00:00.000Z',
        },
      ],
      error: null,
    });
    const mappingIn = vi.fn().mockResolvedValue({
      data: [
        { role_id: 'role-1', capability_key: 'users.read' },
        { role_id: 'role-1', capability_key: 'audit.read' },
      ],
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === 'admin_roles') {
        return { select: vi.fn().mockReturnValue({ order: rolesOrder }) };
      }
      if (table === 'admin_role_capabilities') {
        return { select: vi.fn().mockReturnValue({ in: mappingIn }) };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const service = new AdminRoleInventoryService({
      getClient: vi.fn().mockReturnValue({ from }),
    } as unknown as SupabaseService);

    await expect(service.list()).resolves.toEqual([
      expect.objectContaining({
        id: 'role-1',
        key: 'support',
        capabilities: ['audit.read', 'users.read'],
      }),
    ]);
    expect(mappingIn).toHaveBeenCalledWith('role_id', ['role-1']);
  });

  it('does not query mappings when no roles exist', async () => {
    const mappingSelect = vi.fn();
    const from = vi.fn((table: string) => {
      if (table === 'admin_roles') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      return { select: mappingSelect };
    });
    const service = new AdminRoleInventoryService({
      getClient: vi.fn().mockReturnValue({ from }),
    } as unknown as SupabaseService);

    await expect(service.list()).resolves.toEqual([]);
    expect(mappingSelect).not.toHaveBeenCalled();
  });
});
