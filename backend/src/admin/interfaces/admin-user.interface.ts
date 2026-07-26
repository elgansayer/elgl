export interface AdminUserSummary {
  id: string;
  display_name?: string;
  avatar_url?: string;
  native_languages: string[];
  target_languages: string[];
  is_vip: boolean;
  vip_tier: string;
  is_admin: boolean;
  coins_balance: number;
  study_streak_days: number;
  last_active_at?: string | null;
  created_at: string;
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
