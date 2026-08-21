import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminCapability, isAdminCapability } from './admin-capabilities';

interface AdminRoleAssignmentRow {
  role_id: string;
  expires_at: string | null;
}

interface AdminRoleCapabilityRow {
  capability_key: string;
}

@Injectable()
export class AdminAuthorizationService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getEffectiveCapabilities(userId: string): Promise<AdminCapability[]> {
    const supabase = this.supabaseService.getClient();
    const now = new Date().toISOString();

    const { data: assignments, error: assignmentError } = await supabase
      .from('admin_user_roles')
      .select('role_id, expires_at')
      .eq('user_id', userId)
      .or(`expires_at.is.null,expires_at.gt.${now}`);

    if (assignmentError) {
      throw assignmentError;
    }

    const activeAssignments = (assignments ?? []) as AdminRoleAssignmentRow[];
    const roleIds = [...new Set(activeAssignments.map((row) => row.role_id))];

    if (roleIds.length === 0) {
      return [];
    }

    const { data: capabilityRows, error: capabilityError } = await supabase
      .from('admin_role_capabilities')
      .select('capability_key')
      .in('role_id', roleIds);

    if (capabilityError) {
      throw capabilityError;
    }

    const capabilities = ((capabilityRows ?? []) as AdminRoleCapabilityRow[])
      .map((row) => row.capability_key)
      .filter(isAdminCapability);

    return [...new Set(capabilities)].sort();
  }

  async hasAllCapabilities(
    userId: string,
    requiredCapabilities: readonly AdminCapability[],
  ): Promise<boolean> {
    if (requiredCapabilities.length === 0) {
      return true;
    }

    const effective = new Set(await this.getEffectiveCapabilities(userId));
    return requiredCapabilities.every((capability) =>
      effective.has(capability),
    );
  }
}
