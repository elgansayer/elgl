export interface AdminUserSummary {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  native_languages?: string[] | null;
  target_languages?: string[] | null;
  is_vip?: boolean | null;
  vip_tier?: string | null;
  is_admin?: boolean | null;
  coins_balance?: number | null;
  study_streak_days?: number | null;
  last_active_at?: string | null;
  created_at?: string | null;
}

export interface AdminUserListResult {
  users: AdminUserSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LoginHistoryEntry {
  id: string;
  user_id: string;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface AdminBlockEntry {
  id: string;
  blocker_id: string;
  blocked_id: string;
  blocker_name?: string | null;
  blocked_name?: string | null;
  blocker_avatar?: string | null;
  blocked_avatar?: string | null;
  created_at: string;
}

export interface AdminBlocksListResult {
  blocks: AdminBlockEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminReportEntry {
  id: string;
  reporter_id: string | null;
  reported_user_id: string;
  reason_category: string;
  description: string | null;
  status: string;
  reported_name?: string | null;
  reporter_name?: string | null;
  created_at: string;
}

export interface AdminReportsListResult {
  reports: AdminReportEntry[];
  total: number;
  page: number;
  pageSize: number;
}
