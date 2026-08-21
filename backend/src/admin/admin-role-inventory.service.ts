import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface AdminRoleRow {
  id: string;
  key: string;
  name: string;
  description: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

interface AdminRoleCapabilityRow {
  role_id: string;
  capability_key: string;
}

export interface AdminRoleInventoryEntry extends AdminRoleRow {
  capabilities: string[];
}

@Injectable()
export class AdminRoleInventoryService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async list(): Promise<AdminRoleInventoryEntry[]> {
    const client = this.supabaseService.getClient();
    const { data: roles, error: rolesError } = await client
      .from('admin_roles')
      .select('id, key, name, description, is_system, created_at, updated_at')
      .order('key', { ascending: true });
    if (rolesError) throw rolesError;

    const roleRows = (roles ?? []) as AdminRoleRow[];
    if (roleRows.length === 0) return [];

    const { data: mappings, error: mappingsError } = await client
      .from('admin_role_capabilities')
      .select('role_id, capability_key')
      .in(
        'role_id',
        roleRows.map((role) => role.id),
      );
    if (mappingsError) throw mappingsError;

    const capabilityMap = new Map<string, string[]>();
    for (const mapping of (mappings ?? []) as AdminRoleCapabilityRow[]) {
      const current = capabilityMap.get(mapping.role_id) ?? [];
      current.push(mapping.capability_key);
      capabilityMap.set(mapping.role_id, current);
    }

    return roleRows.map((role) => ({
      ...role,
      capabilities: [...(capabilityMap.get(role.id) ?? [])].sort(),
    }));
  }
}
