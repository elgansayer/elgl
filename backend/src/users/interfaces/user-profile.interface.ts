export interface UserProfile {
  id: string;
  display_name?: string;
  native_languages: string[];
  target_languages: string[];
  /**
   * Queryable language pairs for matching users.
   */
  language_pairs?: { native: string; target: string }[];
  /**
   * Default language code for automatic translation (ISO 639-1).
   */
  default_translation_language?: string;
  bio_text?: string;
  avatar_url?: string;
  audio_intro_url?: string;
  cover_photo_url?: string;
  primary_accent_color?: string;
  interests?: string[];
  hobbies?: string[];
  location?: string;
  mock_location?: unknown;
  mock_country?: string;
  mock_city?: string;
  message_filters?: {
    age_min?: number;
    age_max?: number;
    allowed_genders?: string[];
    allowed_native_languages?: string[];
  };
  is_vip: boolean;
  vip_tier: string;
  coins_balance: number;
  study_streak_days: number;
  correction_ratio: number;
  is_serious_learner: boolean;
  privacy_hide_age: boolean;
  privacy_hide_location: boolean;
  privacy_hide_from_search: boolean;
  matchmaking_consent: boolean;
  privacy_hide_gender: boolean;
  privacy_hide_exact_location: boolean;
  location_privacy?: 'exact' | 'region';
  privacy_hide_online_status: boolean;
  privacy_hide_vip_status: boolean;
  privacy_last_seen?: 'everyone' | 'vips_only' | 'hidden';
  privacy_profile_photo?: 'everyone' | 'vips_only' | 'hidden';
  privacy_about_info?: 'everyone' | 'vips_only' | 'hidden';
  privacy_status?: 'everyone' | 'vips_only' | 'hidden';
  incognito_visits?: boolean;
  do_not_disturb?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  nationality?: string;
  region?: string;
  age?: number;
  gender?: string;
  status_visibility?: string;
  proficiency_level?: string;
  learning_goals?: string;
  availability_morning?: boolean;
  availability_afternoon?: boolean;
  availability_evening?: boolean;
  available_time_start?: string;
  available_time_end?: string;
  is_admin?: boolean;
  created_at: string;
  joined_at?: string; // Optional field for spotlighting recently joined users
  last_active_at?: string;
  distance_metres?: number;
  scheduled_for_deletion_at?: string;
  // Business profile fields
  business_name?: string;
  business_hours?: string;
  website_url?: string;
  catalog?: BusinessCatalogItem[];
  status_text?: string;
  auto_play_voice_notes?: boolean;
  chat_enter_to_send?: boolean;
  chat_text_size?: 'small' | 'medium' | 'large';
  auto_download_media?: boolean;
  auto_download_wifi_only?: boolean;
  auto_download_preference?: 'wifi' | 'cellular';
  silence_unknown_callers?: boolean;
  corrector_score?: number;
  xp_total?: number;
  greeting_message?: string;
  away_message?: string;
  followers_count?: number;
  following_count?: number;
  ai_usage_count?: number; // Tracks AI usage for non-VIP users
  max_target_languages?: number; // Maximum target languages for non-VIP users
  location_spoofing_enabled?: boolean; // Indicates if location spoofing is enabled
  incognito_profile_views?: boolean; // Indicates if incognito profile views are enabled
  custom_avatar_url?: string; // Custom profile picture URL
  about_status?: string; // Custom About status
  notification_preferences?: NotificationPreferences;
}

export interface BusinessCatalogItem {
  id?: string;
  name: string;
  description?: string;
  price?: string;
  currency?: string;
  image_url?: string;
}

export interface NotificationPreferences {
  custom_tone_url?: string;
  vibration_pattern?: number[];
}

export interface ProfileVisitorSummary {
  id: string;
  display_name: string;
  avatar_url: string;
  native_languages: string[];
  target_languages: string[];
}

export interface ProfileVisitor {
  id: string;
  visitor_id: string;
  viewed_id: string;
  created_at: string;
  visitor?: ProfileVisitorSummary;
}
