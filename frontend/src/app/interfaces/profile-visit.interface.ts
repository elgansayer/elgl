export interface ProfileVisit {
  id: string;
  created_at: string;
  is_blurred: boolean;
  visitor: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
    native_languages: string[];
    target_languages: string[];
    bio_text?: string;
    is_vip?: boolean;
  };
}

export interface ProfileVisitorsPage {
  items: ProfileVisit[];
  identity_visible: boolean;
  limit: number;
  offset: number;
  has_more: boolean;
  next_offset: number | null;
}

export interface RecordProfileVisitResponse {
  recorded: boolean;
  ignored: boolean;
  reason?: 'self' | 'incognito' | 'blocked' | 'unavailable' | 'duplicate';
  visit_id?: string;
}
