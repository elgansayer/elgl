import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminRoleAssignmentsQueryDto } from './dto/admin-role-assignments-query.dto';

interface RoleAssignmentRow {
  user_id: string;
  role_id: string;
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
}

interface RoleRow {
  id: string;
  key: string;
  name: string;
}

export interface AdminRoleAssignmentSummary {
  userId: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  grantedBy: string | null;
  grantedAt: string;
  expiresAt: string | null;
  active: boolean;
}

export interface AdminRoleAssignmentsListResult {
  assignments: AdminRoleAssignmentSummary[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class AdminRoleAssignmentsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async list(
    query: AdminRoleAssignmentsQueryDto,
  ): Promise<AdminRoleAssignmentsListResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const client = this.supabaseService.getClient();

    if (
      query.startTime &&
      query.endTime &&
      Date.parse(query.startTime) > Date.parse(query.endTime)
    ) {
      throw new BadRequestException(
        'startTime must be before or equal to endTime',
      );
    }

    let assignmentQuery = client
      .from('admin_user_roles')
      .select('user_id, role_id, granted_by, granted_at, expires_at', {
        count: 'exact',
      });
    if (query.userId)
      assignmentQuery = assignmentQuery.eq('user_id', query.userId);
    if (query.grantedBy)
      assignmentQuery = assignmentQuery.eq('granted_by', query.grantedBy);
    if (query.startTime)
      assignmentQuery = assignmentQuery.gte('granted_at', query.startTime);
    if (query.endTime)
      assignmentQuery = assignmentQuery.lte('granted_at', query.endTime);

    if (query.roleKey) {
      const { data: matchingRoles, error: matchingRolesError } = await client
        .from('admin_roles')
        .select('id')
        .eq('key', query.roleKey);
      if (matchingRolesError) throw matchingRolesError;
      const matchingRoleRows = (matchingRoles ?? []) as Array<{ id: string }>;
      const roleIdsForKey = matchingRoleRows.map((role) => String(role.id));
      if (roleIdsForKey.length === 0) {
        return { assignments: [], total: 0, page, pageSize };
      }
      assignmentQuery = assignmentQuery.in('role_id', roleIdsForKey);
    }

    const { data, error, count } = await assignmentQuery
      .order('granted_at', { ascending: false })
      .range(from, to);
    if (error) throw error;

    const rows = (data ?? []) as RoleAssignmentRow[];
    const roleIds = [...new Set(rows.map((row) => row.role_id))];
    if (rows.length === 0) {
      return { assignments: [], total: count ?? 0, page, pageSize };
    }

    const { data: roles, error: rolesError } = await client
      .from('admin_roles')
      .select('id, key, name')
      .in('id', roleIds);
    if (rolesError) throw rolesError;
    const rolesById = new Map(
      ((roles ?? []) as RoleRow[]).map((role) => [role.id, role]),
    );
    const now = Date.now();

    return {
      assignments: rows.map((row) => {
        const role = rolesById.get(row.role_id);
        return {
          userId: row.user_id,
          roleId: row.role_id,
          roleKey: role?.key ?? 'unknown',
          roleName: role?.name ?? 'Unknown role',
          grantedBy: row.granted_by,
          grantedAt: row.granted_at,
          expiresAt: row.expires_at,
          active: !row.expires_at || new Date(row.expires_at).getTime() > now,
        };
      }),
      total: count ?? 0,
      page,
      pageSize,
    };
  }
}
