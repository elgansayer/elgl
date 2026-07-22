export interface User {
  id: string;
  display_name?: string;
  avatar_url?: string;
  native_language?: string;
  target_languages?: string[];
  bio_text?: string;
  audio_intro_url?: string;
  location?: any;
  mock_location?: any;
  is_vip?: boolean;
  vip_tier?: string;
  coins_balance?: number;
  study_streak_days?: number;
  correction_ratio?: number;
  is_serious_learner?: boolean;
  privacy_hide_age?: boolean;
  privacy_hide_location?: boolean;
  privacy_hide_from_search?: boolean;
  created_at?: string;
}

export interface User {
  id: string;
  aud: string;
  role: string;
  email?: string;
  email_confirmed_at?: string;
  phone?: string;
  phone_confirmed_at?: string;
  confirmation_sent_at?: string;
  confirmed_at?: string;
  last_sign_in_at?: string;
  app_metadata: Record<string, any>;
  user_metadata: Record<string, any>;
  identities?: Array<{
    id: string;
    user_id: string;
    identity_data: Record<string, any>;
    provider: string;
    created_at: string;
    last_sign_in_at: string;
  }>;
  created_at: string;
  updated_at?: string;
}
