export interface UserProfile {
  id: string;
  display_name?: string;
  native_languages: string[];
  target_languages: string[];
  bio_text?: string;
  avatar_url?: string;
  audio_intro_url?: string;
  cover_photo_url?: string;
  primary_accent_color?: string;
  location?: string;
  mock_location?: string;
  is_vip: boolean;
  vip_tier: string;
  coins_balance: number;
  study_streak_days: number;
  correction_ratio: number;
  is_serious_learner: boolean;
  privacy_hide_age: boolean;
  privacy_hide_location: boolean;
  privacy_hide_from_search: boolean;
  privacy_hide_gender: boolean;
  is_admin?: boolean;
  created_at: string;
  scheduled_for_deletion_at?: string;
}

export interface ProfileVisitor {
  id: string;
  visitor_id: string;
  viewed_id: string;
  created_at: string;
  visitor?: {
    id: string;
    display_name?: string;
    avatar_url?: string;
    native_languages?: string[];
    target_languages?: string[];
  };
}
