import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

export type UsersRow = {
  id: string;
  study_streak_days: number | null;
  correction_ratio: number | null;
  xp_total: number | null;
  last_active_at: string | null;
  is_serious_learner: boolean | null;
  totp_secret?: string | null;
  two_factor_secret?: string | null;
  two_factor_enabled?: boolean | null;
  profile_visibility?: string | null;
  status_visibility?: string | null;
  message_filters?: Record<string, unknown> | null;
  business_name?: string | null;
  business_hours?: string | null;
  website_url?: string | null;
  catalog?: unknown[] | null;
  greeting_message?: string | null;
  away_message?: string | null;
  coins_balance?: number | null;
  is_vip?: boolean | null;
  is_admin?: boolean | null;
  vip_tier?: string | null;
  updated_at?: string | null;
  target_languages?: string[] | null;
  native_languages?: string[] | null;
  /** @deprecated superseded by native_languages (see migration 013); retained for legacy callers */
  native_language?: string | null;
  privacy_hide_from_search?: boolean | null;
  matchmaking_consent?: boolean | null;
  incognito_visits?: boolean | null;
  age?: number | null;
  is_deleted?: boolean | null;
  deleted_at?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  bio_text?: string | null;
  status_text?: string | null;
  proficiency_level?: string | null;
  email?: string | null;
  created_at?: string | null;
  mock_country?: string | null;
  mock_city?: string | null;
  privacy_hide_age?: boolean | null;
  privacy_hide_location?: boolean | null;
  privacy_hide_gender?: boolean | null;
  privacy_hide_exact_location?: boolean | null;
  privacy_hide_online_status?: boolean | null;
  privacy_hide_vip_status?: boolean | null;
  privacy_last_seen?: string | null;
  privacy_profile_photo?: string | null;
  privacy_about_info?: string | null;
  privacy_status?: string | null;
  auto_play_voice_notes?: boolean | null;
  sound_effects_enabled?: boolean | null;
  vibration_enabled?: boolean | null;
  chat_enter_to_send?: boolean | null;
  chat_text_size?: string | null;
  silence_unknown_callers?: boolean | null;
  scheduled_for_deletion_at?: string | null;
  learning_goals?: string[] | null;
  interests?: string[] | null;
  gender?: string | null;
  location?: string | null;
  mock_location?: string | null;
  enable_location_spoofing?: boolean | null;
  audio_intro_url?: string | null;
  cover_photo_url?: string | null;
  cover_url?: string | null;
  serious_learner_mode?: boolean | null;
  notification_preferences?: Record<string, unknown> | null;
  language_levels?: Record<string, string> | null;
  chat_preferences?: Record<string, unknown> | null;
  developer_api_key?: string | null;
  deletion_requested_at?: string | null;
  deletion_grace_days?: number | null;
  is_deletion_pending?: boolean | null;
};

export type AudioRoomsRow = {
  id: string;
  room_name: string;
  title: string;
  party_type?: string | null;
  event_id?: string | null;
  target_language: string;
  language_pair: string;
  topic_tag: string;
  level?: string | null;
  host_id: string;
  co_host_id?: string | null;
  is_video_stream: boolean;
  is_active: boolean;
  speakers: string[];
  raised_hands: string[];
  listeners_count: number;
  participants_count?: number | null;
  recording_url?: string | null;
  egress_id?: string | null;
  is_private?: boolean | null;
  invited_user_ids?: string[] | null;
  biometric_lock?: boolean | null;
  created_at: string;
};

type AudioRoomCaptionRow = {
  id: string;
  room_id: string;
  speaker_id: string;
  speaker_name?: string | null;
  text_content: string;
  created_at: string;
};

type AudioRoomNoteRow = {
  id: string;
  room_id: string;
  author_id: string;
  author_name: string | null;
  content: string;
  vocabulary?: string | null;
  created_at: string;
};

type AudioRoomTranscriptRow = {
  id: string;
  room_id: string;
  recording_url: string | null;
  transcript_text: string | null;
  session_summary: string | null;
  vocabulary_list: string[] | null;
  created_at: string;
};

type AudioRoomTipRow = {
  id: string;
  room_id: string;
  sender_user_id: string;
  receiver_user_id: string;
  amount_coins: number;
  created_at?: string;
};

type CallLogRow = {
  id: string;
  caller_id: string;
  caller_name: string;
  receiver_id: string;
  receiver_name: string;
  call_type: 'incoming' | 'outgoing' | 'missed';
  room_name: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
};

type QuickPollRow = {
  id: string;
  room_id: string;
  host_id: string;
  question: string;
  options: string[];
  is_active: boolean;
  created_at?: string;
};

type PollVoteRow = {
  id: string;
  poll_id: string;
  user_id: string;
  option_index: number;
  created_at?: string;
};

type MediaRow = {
  id: string;
  user_id: string;
  view_once: boolean;
  viewed: boolean;
};

type PasswordResetTokenRow = {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  used: boolean;
  created_at?: string;
};

type ArchiveRequestRow = {
  id: string;
  user_id: string;
  requested_at: string;
  archive_url: string;
  receipt_id?: string | null;
  app_store?: string | null;
};

type SubscriptionEventRow = {
  id: string;
  user_id?: string | null;
  event_type: string;
  product_id?: string | null;
  original_transaction_id?: string | null;
  notification_type?: string | null;
  notification_subtype?: string | null;
  payload?: Record<string, unknown> | null;
  created_at?: string;
};

type UserInterestRow = {
  id: string;
  user_id: string;
  tag: string;
  created_at?: string | null;
};

type InterestVocabularyRow = {
  id: string;
  interest_tag: string;
  language: string;
  vocab_word: string;
  translation?: string | null;
  srs_level?: number | null;
  created_at?: string | null;
};

export type CommunityRow = {
  id: string;
  name: string;
  description?: string | null;
  owner_id: string;
  created_at: string;
};

type AchievementRow = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  icon_url?: string | null;
  created_at?: string;
};

type UserAchievementRow = {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at?: string;
};

type HobbyTagRow = {
  id: string;
  name: string;
  category: string;
  icon?: string;
  target_vocabulary?: unknown[] | null;
  created_at?: string;
};

type UserHobbyTagRow = {
  id: string;
  user_id: string;
  hobby_tag_id: string;
  proficiency_level?: number;
  created_at?: string;
};

type MilestoneRow = {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  completed?: boolean;
  completed_at?: string | null;
  created_at?: string;
};

type StudyBuddyRequestRow = {
  id: string;
  requester_id: string;
  partner_id: string;
  message?: string | null;
  status?: 'pending' | 'accepted' | 'declined';
  created_at?: string;
  updated_at?: string;
};

type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: string;
  entity_id?: string | null;
  message?: string | null;
  is_read?: boolean;
  created_at?: string;
};

type UserPushTokenRow = {
  id: string;
  user_id: string;
  fcm_token: string;
  platform?: string;
  created_at?: string | null;
};

type ResourceLibraryRow = {
  id: string;
  title: string;
  description?: string | null;
  url: string;
  category?: string | null;
  created_by: string;
  type?: string | null;
  content?: string | null;
  topic?: string | null;
  difficulty?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ReadingResourceRow = {
  id: string;
  title: string;
  content: string;
  language: string;
  difficulty?: string | null;
  topic?: string | null;
  source_url?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ReadingProgressRow = {
  user_id: string;
  words_read: number;
  articles_completed: number;
  total_reading_time_seconds: number;
  fluency_percentage: number;
  last_read_at?: string | null;
  updated_at: string;
};

export type LessonRow = {
  id: string;
  title: string;
  description?: string | null;
  content_json?: Record<string, unknown> | null;
  language_code: string;
  difficulty_level?: number | null;
  cover_image_url?: string | null;
  audio_url?: string | null;
  created_at?: string;
  updated_at?: string | null;
};

type LinkedAccountRow = {
  id: string;
  user_id: string;
  provider: string;
  name?: string | null;
  active?: boolean;
  created_at?: string;
};

type CulturalTagRow = {
  id: string;
  moment_id: string;
  tag_name: string;
  created_at?: string;
};

type CorrectorRatingRow = {
  id: string;
  rater_id: string;
  rated_user_id: string;
  score: number;
  created_at?: string;
};

export type GroupsRow = {
  id: string;
  name: string;
  owner_id: string;
  community_id: string | null;
  interest_id: string | null;
  max_members: number;
  can_send_messages: boolean | null;
  can_edit_info: boolean | null;
  description: string | null;
  rules: string | null;
  created_at: string;
};

type GroupMembersRow = {
  id: string;
  group_id: string;
  user_id: string;
};

type GroupAnnouncementsRow = {
  id: string;
  group_id: string;
  sender_id: string;
  message: string;
  created_at: string;
};

type GroupResourcesRow = {
  id: string;
  group_id: string;
  title: string;
  url: string;
  description: string | null;
  created_at: string;
};

type InterestsRow = {
  id: string;
  name: string;
};

type XpEventRow = {
  id: string;
  user_id: string;
  points: number;
  activity: string;
  created_at: string;
};

type UserFollowRow = {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
};

type UserProfileLikeRow = {
  id: string;
  liker_id: string;
  liked_id: string;
  created_at: string;
};

type ProfileVisitRow = {
  id: string;
  visitor_id: string;
  viewed_id: string;
  viewer_id?: string;
  created_at: string;
};

type StatusViewRow = {
  id: string;
  viewer_id: string;
  status_owner_id: string;
  status_id?: string | null;
  created_at: string;
};

type LocationShareRow = {
  id: string;
  sharer_user_id: string;
  viewer_user_id: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type VirtualGiftRow = {
  id: string;
  name: string;
  icon: string;
  cost_coins: number;
  animation_type: string;
  animation_url?: string | null;
};

type StickerPackRow = {
  id: string;
  name: string;
  cost_coins: number;
  icon_url?: string | null;
  description?: string | null;
  is_animated?: boolean | null;
  sticker_urls?: string[] | null;
  animation_url?: string | null;
};

type GiftTransactionRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  gift_id: string;
  room_id?: string | null;
  coins_spent: number;
  created_at?: string;
};

type CoinTransactionRow = {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
};

type UserStickerPackRow = {
  user_id: string;
  pack_id: string;
  created_at?: string;
};

type MomentRow = {
  id: string;
  author_id?: string | null;
  user_id?: string | null;
  text_content?: string | null;
  /** @deprecated legacy alias for text_content used by some older call sites */
  content_text?: string | null;
  media_urls?: string[] | null;
  media_type?: string | null;
  voice_note_url?: string | null;
  detected_language?: string | null;
  target_language?: string | null;
  post_type?: string | null;
  question_text?: string | null;
  question_options?: string[] | null;
  correct_answer?: string | null;
  is_pinned?: boolean | null;
  likes_count?: number | null;
  comments_count?: number | null;
  correct_answers_count?: number | null;
  total_answers_count?: number | null;
  is_ephemeral?: boolean | null;
  expires_at?: string | null;
  created_at: string;
};

type MomentCommentRow = {
  id: string;
  user_id: string;
  author_id?: string;
  moment_id: string;
  text_content: string | null;
  correction_payload?: {
    original: string;
    corrected: string;
    explanation?: string;
  } | null;
  parent_comment_id?: string | null;
  reply_to_user_id?: string | null;
  created_at: string;
};

type MomentLikeRow = {
  id: string;
  user_id: string;
  moment_id: string;
  created_at: string;
};

type MomentCommentVotesRow = {
  id: string;
  comment_id: string;
  user_id: string;
  vote: string;
  created_at?: string;
};

type MomentQuestionAnswersRow = {
  id?: string;
  moment_id: string;
  user_id: string;
  answer: string;
  is_correct: boolean;
  created_at?: string;
};

type TranslationRow = {
  id: string;
  source_text?: string | null;
  translated_text?: string | null;
  source_language?: string | null;
  target_language?: string | null;
  created_at?: string;
};

type FlashcardRow = {
  id: string;
  user_id: string;
  word_token: string;
  original_context?: string | null;
  translation: string;
  definition?: string | null;
  pronunciation_url?: string | null;
  srs_level: number;
  easiness_factor: number;
  repetition_count: number;
  repetitions: number;
  interval_days: number;
  next_review_at: string;
  created_at: string;
};

type FavouriteRow = {
  id: string;
  user_id: string;
  item_type: string;
  item_payload: Record<string, unknown>;
  notes: string | null;
  created_at: string;
};

type LoginHistoryRow = {
  id: string;
  user_id: string;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
};

export type ChatMessageRow = {
  id: string;
  room_id: string;
  sender_id: string;
  message_type: string;
  text_content?: string | null;
  media_url?: string | null;
  channel_id?: string | null;
  correction_payload?: {
    original: string;
    corrected: string;
    explanation?: string;
  } | null;
  correction_request_payload?: {
    original_text: string;
    target_language?: string;
  } | null;
  status_reply_payload?: {
    status_update_id: string;
    status_text: string;
  } | null;
  gift_payload?: {
    gift_id: string;
    gift_name: string;
    gift_icon: string;
    coin_value: number;
    animation_type?: string;
    animation_url?: string | null;
  } | null;
  reply_to_id?: string | null;
  is_view_once?: boolean;
  viewed_at?: string | null;
  is_read: boolean;
  created_at: string;
  is_deleted_for_sender?: boolean;
  is_deleted_for_everyone?: boolean;
  is_edited?: boolean;
  edited_at?: string | null;
  is_starred?: boolean;
  is_forwarded?: boolean;
  delivery_status?: 'sent' | 'delivered' | 'read';
  expires_at?: string | null;
  deleted_for_user_ids?: string[] | null;
};

type BlockRow = {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at?: string;
};

type ReportRow = {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason_category: string;
  status: string;
  description?: string | null;
  context_url?: string | null;
  created_at?: string;
};

export interface Database {
  public: {
    Tables: {
      users: {
        Row: UsersRow;
        Insert: Partial<UsersRow>;
        Update: Partial<UsersRow>;
        Relationships: [];
      };
      reading_engine_crash_reports: {
        Row: {
          id: string;
          operation: string;
          user_id: string | null;
          resource_id: string | null;
          error_type: string;
          error_message: string;
          stack_trace: string | null;
          context: Record<string, unknown> | null;
          created_at: string;
          acknowledged: boolean;
          resolved_at: string | null;
        };
        Insert: Partial<
          Database['public']['Tables']['reading_engine_crash_reports']['Row']
        >;
        Update: Partial<
          Database['public']['Tables']['reading_engine_crash_reports']['Row']
        >;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          category: string | null;
          date_time: string;
          location: string | null;
          language_pair: string | null;
          max_participants: number | null;
          host_id: string;
          is_cancelled?: boolean;
          proficiency?: string | null;
        };
        Insert: Partial<{
          id?: string;
          title: string;
          description?: string | null;
          category?: string | null;
          date_time: string;
          location?: string | null;
          language_pair?: string | null;
          max_participants?: number | null;
          host_id: string;
          is_cancelled?: boolean;
          proficiency?: string | null;
        }>;
        Update: Partial<{
          id?: string;
          title?: string;
          description?: string | null;
          category?: string | null;
          date_time?: string;
          location?: string | null;
          language_pair?: string | null;
          max_participants?: number | null;
          host_id?: string;
          is_cancelled?: boolean;
          proficiency?: string | null;
        }>;
        Relationships: [];
      };
      event_rsvps: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          status: string;
        };
        Insert: Partial<{
          id?: string;
          event_id: string;
          user_id: string;
          status: string;
        }>;
        Update: Partial<{
          id?: string;
          event_id?: string;
          user_id?: string;
          status?: string;
        }>;
        Relationships: [];
      };
      event_reminders_sent: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
        };
        Insert: Partial<{
          id?: string;
          event_id: string;
          user_id: string;
        }>;
        Update: Partial<{
          id?: string;
          event_id?: string;
          user_id?: string;
        }>;
        Relationships: [];
      };
      audio_rooms: {
        Row: AudioRoomsRow;
        Insert: Partial<AudioRoomsRow>;
        Update: Partial<AudioRoomsRow>;
        Relationships: [];
      };
      audio_room_captions: {
        Row: AudioRoomCaptionRow;
        Insert: Partial<AudioRoomCaptionRow>;
        Update: Partial<AudioRoomCaptionRow>;
        Relationships: [];
      };
      audio_room_notes: {
        Row: AudioRoomNoteRow;
        Insert: Partial<AudioRoomNoteRow>;
        Update: Partial<AudioRoomNoteRow>;
        Relationships: [];
      };
      audio_room_transcripts: {
        Row: AudioRoomTranscriptRow;
        Insert: Partial<AudioRoomTranscriptRow>;
        Update: Partial<AudioRoomTranscriptRow>;
        Relationships: [];
      };
      audio_room_tips: {
        Row: AudioRoomTipRow;
        Insert: Partial<AudioRoomTipRow>;
        Update: Partial<AudioRoomTipRow>;
        Relationships: [];
      };
      call_logs: {
        Row: CallLogRow;
        Insert: Partial<CallLogRow>;
        Update: Partial<CallLogRow>;
        Relationships: [];
      };
      quick_polls: {
        Row: QuickPollRow;
        Insert: Partial<QuickPollRow>;
        Update: Partial<QuickPollRow>;
        Relationships: [];
      };
      poll_votes: {
        Row: PollVoteRow;
        Insert: Partial<PollVoteRow>;
        Update: Partial<PollVoteRow>;
        Relationships: [];
      };
      groups: {
        Row: GroupsRow;
        Insert: Partial<GroupsRow>;
        Update: Partial<GroupsRow>;
        Relationships: [];
      };
      group_members: {
        Row: GroupMembersRow;
        Insert: Partial<GroupMembersRow>;
        Update: Partial<GroupMembersRow>;
        Relationships: [];
      };
      group_announcements: {
        Row: GroupAnnouncementsRow;
        Insert: Partial<GroupAnnouncementsRow>;
        Update: Partial<GroupAnnouncementsRow>;
        Relationships: [];
      };
      group_resources: {
        Row: GroupResourcesRow;
        Insert: Partial<GroupResourcesRow>;
        Update: Partial<GroupResourcesRow>;
        Relationships: [];
      };
      interests: {
        Row: InterestsRow;
        Insert: Partial<InterestsRow>;
        Update: Partial<InterestsRow>;
        Relationships: [];
      };
      communities: {
        Row: CommunityRow;
        Insert: Partial<CommunityRow>;
        Update: Partial<CommunityRow>;
        Relationships: [];
      };
      achievements: {
        Row: AchievementRow;
        Insert: Partial<AchievementRow>;
        Update: Partial<AchievementRow>;
        Relationships: [];
      };
      user_achievements: {
        Row: UserAchievementRow;
        Insert: Partial<UserAchievementRow>;
        Update: Partial<UserAchievementRow>;
        Relationships: [
          {
            foreignKeyName: 'user_achievements_achievement_id_fkey';
            columns: ['achievement_id'];
            isOneToOne: false;
            referencedRelation: 'achievements';
            referencedColumns: ['id'];
          },
        ];
      };
      hobby_tags: {
        Row: HobbyTagRow;
        Insert: Partial<HobbyTagRow>;
        Update: Partial<HobbyTagRow>;
        Relationships: [];
      };
      user_hobby_tags: {
        Row: UserHobbyTagRow;
        Insert: Partial<UserHobbyTagRow>;
        Update: Partial<UserHobbyTagRow>;
        Relationships: [
          {
            foreignKeyName: 'user_hobby_tags_hobby_tag_id_fkey';
            columns: ['hobby_tag_id'];
            isOneToOne: false;
            referencedRelation: 'hobby_tags';
            referencedColumns: ['id'];
          },
        ];
      };
      milestones: {
        Row: MilestoneRow;
        Insert: Partial<MilestoneRow>;
        Update: Partial<MilestoneRow>;
        Relationships: [];
      };
      study_buddy_requests: {
        Row: StudyBuddyRequestRow;
        Insert: Partial<StudyBuddyRequestRow>;
        Update: Partial<StudyBuddyRequestRow>;
        Relationships: [
          {
            foreignKeyName: 'study_buddy_requests_requester_id_fkey';
            columns: ['requester_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'study_buddy_requests_partner_id_fkey';
            columns: ['partner_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: NotificationRow;
        Insert: Partial<NotificationRow>;
        Update: Partial<NotificationRow>;
        Relationships: [
          {
            foreignKeyName: 'notifications_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_push_tokens: {
        Row: UserPushTokenRow;
        Insert: Partial<UserPushTokenRow>;
        Update: Partial<UserPushTokenRow>;
        Relationships: [];
      };
      resource_library: {
        Row: ResourceLibraryRow;
        Insert: Partial<ResourceLibraryRow>;
        Update: Partial<ResourceLibraryRow>;
        Relationships: [];
      };
      reading_resources: {
        Row: ReadingResourceRow;
        Insert: Partial<ReadingResourceRow>;
        Update: Partial<ReadingResourceRow>;
        Relationships: [];
      };
      reading_progress: {
        Row: ReadingProgressRow;
        Insert: Partial<ReadingProgressRow>;
        Update: Partial<ReadingProgressRow>;
        Relationships: [];
      };
      lessons: {
        Row: LessonRow;
        Insert: Partial<LessonRow>;
        Update: Partial<LessonRow>;
        Relationships: [];
      };
      linked_accounts: {
        Row: LinkedAccountRow;
        Insert: Partial<LinkedAccountRow>;
        Update: Partial<LinkedAccountRow>;
        Relationships: [];
      };
      cultural_tags: {
        Row: CulturalTagRow;
        Insert: Partial<CulturalTagRow>;
        Update: Partial<CulturalTagRow>;
        Relationships: [];
      };
      corrector_ratings: {
        Row: CorrectorRatingRow;
        Insert: Partial<CorrectorRatingRow>;
        Update: Partial<CorrectorRatingRow>;
        Relationships: [];
      };
      media: {
        Row: MediaRow;
        Insert: Partial<MediaRow>;
        Update: Partial<MediaRow>;
        Relationships: [];
      };
      password_reset_tokens: {
        Row: PasswordResetTokenRow;
        Insert: Partial<PasswordResetTokenRow>;
        Update: Partial<PasswordResetTokenRow>;
        Relationships: [];
      };
      archive_requests: {
        Row: ArchiveRequestRow;
        Insert: Partial<ArchiveRequestRow>;
        Update: Partial<ArchiveRequestRow>;
        Relationships: [];
      };
      subscription_events: {
        Row: SubscriptionEventRow;
        Insert: Partial<SubscriptionEventRow>;
        Update: Partial<SubscriptionEventRow>;
        Relationships: [];
      };
      user_interests: {
        Row: UserInterestRow;
        Insert: Partial<UserInterestRow>;
        Update: Partial<UserInterestRow>;
        Relationships: [];
      };
      interest_vocabulary: {
        Row: InterestVocabularyRow;
        Insert: Partial<InterestVocabularyRow>;
        Update: Partial<InterestVocabularyRow>;
        Relationships: [];
      };
      xp_events: {
        Row: XpEventRow;
        Insert: Partial<XpEventRow>;
        Update: Partial<XpEventRow>;
        Relationships: [];
      };
      user_follows: {
        Row: UserFollowRow;
        Insert: Partial<UserFollowRow>;
        Update: Partial<UserFollowRow>;
        Relationships: [];
      };
      user_profile_likes: {
        Row: UserProfileLikeRow;
        Insert: Partial<UserProfileLikeRow>;
        Update: Partial<UserProfileLikeRow>;
        Relationships: [];
      };
      profile_visits: {
        Row: ProfileVisitRow;
        Insert: Partial<ProfileVisitRow>;
        Update: Partial<ProfileVisitRow>;
        Relationships: [];
      };
      status_views: {
        Row: StatusViewRow;
        Insert: Partial<StatusViewRow>;
        Update: Partial<StatusViewRow>;
        Relationships: [];
      };
      moments: {
        Row: MomentRow;
        Insert: Partial<MomentRow>;
        Update: Partial<MomentRow>;
        Relationships: [];
      };
      moment_comments: {
        Row: MomentCommentRow;
        Insert: Partial<MomentCommentRow>;
        Update: Partial<MomentCommentRow>;
        Relationships: [];
      };
      moment_likes: {
        Row: MomentLikeRow;
        Insert: Partial<MomentLikeRow>;
        Update: Partial<MomentLikeRow>;
        Relationships: [];
      };
      moment_comment_votes: {
        Row: MomentCommentVotesRow;
        Insert: Partial<MomentCommentVotesRow>;
        Update: Partial<MomentCommentVotesRow>;
        Relationships: [];
      };
      moment_question_answers: {
        Row: MomentQuestionAnswersRow;
        Insert: Partial<MomentQuestionAnswersRow>;
        Update: Partial<MomentQuestionAnswersRow>;
        Relationships: [];
      };
      translations: {
        Row: TranslationRow;
        Insert: Partial<TranslationRow>;
        Update: Partial<TranslationRow>;
        Relationships: [];
      };
      flashcards: {
        Row: FlashcardRow;
        Insert: Partial<FlashcardRow>;
        Update: Partial<FlashcardRow>;
        Relationships: [];
      };
      favourites: {
        Row: FavouriteRow;
        Insert: Partial<FavouriteRow>;
        Update: Partial<FavouriteRow>;
        Relationships: [];
      };
      user_quests: {
        Row: {
          id: string;
          user_id: string;
          quest_type: string;
          quest_key: string;
          progress: number;
          target: number;
          reward_coins: number;
          completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<{
          id?: string;
          user_id: string;
          quest_type: string;
          quest_key: string;
          progress?: number;
          target: number;
          reward_coins: number;
          completed?: boolean;
          created_at?: string;
          updated_at?: string;
        }>;
        Update: Partial<{
          id?: string;
          user_id?: string;
          quest_type?: string;
          quest_key?: string;
          progress?: number;
          target?: number;
          reward_coins?: number;
          completed?: boolean;
          created_at?: string;
          updated_at?: string;
        }>;
        Relationships: [];
      };
      chat_messages: {
        Row: ChatMessageRow;
        Insert: Partial<ChatMessageRow>;
        Update: Partial<ChatMessageRow>;
        Relationships: [
          {
            foreignKeyName: 'chat_messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          new_message: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          call_invite: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          moment_like: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          moment_comment: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          correction: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          gift: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          profile_view: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          study_reminder: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          friend_request: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          audio_room_invite: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          new_follower: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          quiet_hours_start: string | null;
          quiet_hours_end: string | null;
          do_not_disturb: boolean;
          custom_tone_url: string | null;
          vibration_pattern: string | null;
          updated_at: string;
          preferences?: Record<string, unknown> | null;
        };
        Insert: Partial<{
          user_id: string;
          new_message?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          call_invite?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          moment_like?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          moment_comment?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          correction?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          gift?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          profile_view?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          study_reminder?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          friend_request?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          audio_room_invite?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
          };
          new_follower?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          quiet_hours_start?: string | null;
          quiet_hours_end?: string | null;
          do_not_disturb?: boolean;
          custom_tone_url?: string | null;
          vibration_pattern?: string | null;
          updated_at?: string;
        }>;
        Update: Partial<{
          user_id?: string;
          new_message?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          call_invite?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          moment_like?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          moment_comment?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          correction?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          gift?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          profile_view?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          study_reminder?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          friend_request?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          audio_room_invite?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
          };
          new_follower?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
            badges: boolean;
          };
          quiet_hours_start?: string | null;
          quiet_hours_end?: string | null;
          do_not_disturb?: boolean;
          custom_tone_url?: string | null;
          vibration_pattern?: string | null;
          updated_at?: string;
        }>;
        Relationships: [];
      };
      chat_rooms: {
        Row: {
          id: string;
          title: string | null;
          subtitle?: string | null;
          avatar?: string | null;
          is_online: boolean | null;
          is_pinned: boolean | null;
          is_locked?: boolean | null;
          created_at?: string;
          admin_id?: string;
          invite_code?: string | null;
          is_announcement?: boolean | null;
          max_members?: number;
          wallpaper_url?: string | null;
          labels?: string[] | null;
        };
        Insert: Partial<{
          id?: string;
          title?: string | null;
          subtitle?: string | null;
          avatar?: string | null;
          is_online?: boolean | null;
          is_pinned?: boolean | null;
          is_locked?: boolean | null;
          created_at?: string;
          admin_id?: string;
          invite_code?: string | null;
          is_announcement?: boolean | null;
          max_members?: number;
          wallpaper_url?: string | null;
          labels?: string[] | null;
        }>;
        Update: Partial<{
          id?: string;
          title?: string | null;
          subtitle?: string | null;
          avatar?: string | null;
          is_online?: boolean | null;
          is_pinned?: boolean | null;
          is_locked?: boolean | null;
          created_at?: string;
          admin_id?: string;
          invite_code?: string | null;
          is_announcement?: boolean | null;
          max_members?: number;
          wallpaper_url?: string | null;
          labels?: string[] | null;
        }>;
        Relationships: [];
      };
      chat_room_members: {
        Row: {
          user_id: string;
          room_id: string;
          is_locked: boolean;
          created_at?: string;
        };
        Insert: Partial<{
          user_id: string;
          room_id: string;
          is_locked?: boolean;
          created_at?: string;
        }>;
        Update: Partial<{
          user_id?: string;
          room_id?: string;
          is_locked?: boolean;
          created_at?: string;
        }>;
        Relationships: [
          {
            foreignKeyName: 'chat_room_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      developer_metrics: {
        Row: {
          user_id: string;
          total_api_calls_today?: number;
          avg_latency_ms?: number;
          updated_at?: string;
        };
        Insert: {
          user_id: string;
          total_api_calls_today?: number;
          avg_latency_ms?: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          total_api_calls_today?: number;
          avg_latency_ms?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      developer_diagnostic_logs: {
        Row: {
          id: string;
          user_id: string | null;
          category: 'POSTGIS' | 'CENTRIFUGO' | 'REDIS' | 'LIVEKIT';
          status: 'info' | 'success' | 'warn';
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string | null;
          category: 'POSTGIS' | 'CENTRIFUGO' | 'REDIS' | 'LIVEKIT';
          status: 'info' | 'success' | 'warn';
          message: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          category?: 'POSTGIS' | 'CENTRIFUGO' | 'REDIS' | 'LIVEKIT';
          status?: 'info' | 'success' | 'warn';
          message?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      chat_room_announcements: {
        Row: {
          id: string;
          room_id: string;
          admin_id: string;
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          admin_id: string;
          message: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          admin_id?: string;
          message?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      virtual_gifts: {
        Row: VirtualGiftRow;
        Insert: Partial<VirtualGiftRow>;
        Update: Partial<VirtualGiftRow>;
        Relationships: [];
      };
      sticker_packs: {
        Row: StickerPackRow;
        Insert: Partial<StickerPackRow>;
        Update: Partial<StickerPackRow>;
        Relationships: [];
      };
      gift_transactions: {
        Row: GiftTransactionRow;
        Insert: Partial<GiftTransactionRow>;
        Update: Partial<GiftTransactionRow>;
        Relationships: [];
      };
      coin_transactions: {
        Row: CoinTransactionRow;
        Insert: Partial<CoinTransactionRow>;
        Update: Partial<CoinTransactionRow>;
        Relationships: [];
      };
      user_sticker_packs: {
        Row: UserStickerPackRow;
        Insert: Partial<UserStickerPackRow>;
        Update: Partial<UserStickerPackRow>;
        Relationships: [];
      };
      login_history: {
        Row: LoginHistoryRow;
        Insert: Partial<LoginHistoryRow>;
        Update: Partial<LoginHistoryRow>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          user_id: string;
          product_id: string | null;
          status: string;
          transaction_id: string | null;
          auto_renew: boolean;
          renewal_product_id: string | null;
          expires_at: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          product_id?: string | null;
          status?: string;
          transaction_id?: string | null;
          auto_renew?: boolean;
          renewal_product_id?: string | null;
          expires_at?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          product_id?: string | null;
          status?: string;
          transaction_id?: string | null;
          auto_renew?: boolean;
          renewal_product_id?: string | null;
          expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      coin_purchases: {
        Row: {
          user_id: string;
          package_id: string;
          coins_added: number;
          amount_paid: number;
          currency: string;
          receipt_token: string;
          platform: string;
          transaction_id: string;
          status: string;
          created_at: string;
        };
        Insert: Partial<{
          user_id: string;
          package_id: string;
          coins_added: number;
          amount_paid: number;
          currency: string;
          receipt_token: string;
          platform: string;
          transaction_id: string;
          status: string;
          created_at?: string;
        }>;
        Update: Partial<{
          user_id?: string;
          package_id?: string;
          coins_added?: number;
          amount_paid?: number;
          currency?: string;
          receipt_token?: string;
          platform?: string;
          transaction_id?: string;
          status?: string;
          created_at?: string;
        }>;
        Relationships: [];
      };
      escrow_transactions: {
        Row: {
          id: string;
          payer_id: string;
          payee_id: string;
          amount_coins: number;
          status:
            | 'held'
            | 'released'
            | 'refunded'
            | 'disputed'
            | 'cancelled'
            | 'pending';
          description: string | null;
          reference_id: string | null;
          created_at: string;
          updated_at: string;
          released_at: string | null;
          refunded_at: string | null;
        };
        Insert: Partial<{
          id?: string;
          payer_id: string;
          payee_id: string;
          amount_coins: number;
          status?:
            | 'held'
            | 'released'
            | 'refunded'
            | 'disputed'
            | 'cancelled'
            | 'pending';
          description?: string | null;
          reference_id?: string | null;
          created_at?: string;
          updated_at?: string;
          released_at?: string | null;
          refunded_at?: string | null;
        }>;
        Update: Partial<{
          id?: string;
          payer_id?: string;
          payee_id?: string;
          amount_coins?: number;
          status?:
            | 'held'
            | 'released'
            | 'refunded'
            | 'disputed'
            | 'cancelled'
            | 'pending';
          description?: string | null;
          reference_id?: string | null;
          created_at?: string;
          updated_at?: string;
          released_at?: string | null;
          refunded_at?: string | null;
        }>;
        Relationships: [];
      };
      blocks: {
        Row: BlockRow;
        Insert: {
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
          id?: string;
        };
        Update: Partial<{
          blocker_id?: string;
          blocked_id?: string;
          created_at?: string;
          id?: string;
        }>;
        Relationships: [];
      };
      reports: {
        Row: ReportRow;
        Insert: {
          reporter_id: string;
          reported_user_id: string;
          reason_category: string;
          status?: string;
          description?: string | null;
          context_url?: string | null;
          created_at?: string;
          id?: string;
        };
        Update: Partial<{
          reporter_id?: string;
          reported_user_id?: string;
          reason_category?: string;
          status?: string;
          description?: string | null;
          context_url?: string | null;
          created_at?: string;
          id?: string;
        }>;
        Relationships: [];
      };
      apple_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          original_transaction_id: string;
          product_id: string;
          transaction_id: string;
          expires_date?: string | null;
          purchase_date?: string | null;
          status?: string | null;
          created_at?: string;
        };
        Insert: Partial<{
          id?: string;
          user_id: string;
          original_transaction_id: string;
          product_id: string;
          transaction_id: string;
          expires_date?: string | null;
          purchase_date?: string | null;
          status?: string | null;
          created_at?: string;
        }>;
        Update: Partial<{
          id?: string;
          user_id?: string;
          original_transaction_id?: string;
          product_id?: string;
          transaction_id?: string;
          expires_date?: string | null;
          purchase_date?: string | null;
          status?: string | null;
          created_at?: string;
        }>;
        Relationships: [];
      };
      google_play_purchases: {
        Row: {
          id: string;
          user_id: string;
          purchase_token: string;
          subscription_id: string;
          status?: string | null;
          created_at?: string;
        };
        Insert: Partial<{
          id?: string;
          user_id: string;
          purchase_token: string;
          subscription_id: string;
          status?: string | null;
          created_at?: string;
        }>;
        Update: Partial<{
          id?: string;
          user_id?: string;
          purchase_token?: string;
          subscription_id?: string;
          status?: string | null;
          created_at?: string;
        }>;
        Relationships: [];
      };
      curated_articles: {
        Row: {
          id: string;
          title: string;
          cefr_level?: string | null;
          language?: string | null;
          source_url?: string | null;
          content_text?: string | null;
          word_count?: number | null;
          difficulty_rating?: number | null;
          audio_url?: string | null;
          image_url?: string | null;
          tags?: string[] | null;
          created_at?: string;
        };
        Insert: Partial<{
          id?: string;
          title: string;
          cefr_level?: string | null;
          language?: string | null;
          source_url?: string | null;
          content_text?: string | null;
          word_count?: number | null;
          difficulty_rating?: number | null;
          audio_url?: string | null;
          image_url?: string | null;
          tags?: string[] | null;
          created_at?: string;
        }>;
        Update: Partial<{
          id?: string;
          title?: string;
          cefr_level?: string | null;
          language?: string | null;
          source_url?: string | null;
          content_text?: string | null;
          word_count?: number | null;
          difficulty_rating?: number | null;
          audio_url?: string | null;
          image_url?: string | null;
          tags?: string[] | null;
          created_at?: string;
        }>;
        Relationships: [];
      };
      curated_dialogues: {
        Row: {
          id: string;
          title: string;
          cefr_level?: string | null;
          language?: string | null;
          source_url?: string | null;
          lines?: unknown[] | null;
          audio_url?: string | null;
          image_url?: string | null;
          tags?: string[] | null;
          created_at?: string;
        };
        Insert: Partial<{
          id?: string;
          title: string;
          cefr_level?: string | null;
          language?: string | null;
          source_url?: string | null;
          lines?: unknown[] | null;
          audio_url?: string | null;
          image_url?: string | null;
          tags?: string[] | null;
          created_at?: string;
        }>;
        Update: Partial<{
          id?: string;
          title?: string;
          cefr_level?: string | null;
          language?: string | null;
          source_url?: string | null;
          lines?: unknown[] | null;
          audio_url?: string | null;
          image_url?: string | null;
          tags?: string[] | null;
          created_at?: string;
        }>;
        Relationships: [];
      };
      language_islands: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          language_pair: string;
          host_id: string;
          max_members: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<{
          id?: string;
          name: string;
          description?: string | null;
          language_pair: string;
          host_id: string;
          max_members?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        }>;
        Update: Partial<{
          id?: string;
          name?: string;
          description?: string | null;
          language_pair?: string;
          host_id?: string;
          max_members?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        }>;
        Relationships: [];
      };
      language_island_members: {
        Row: {
          island_id: string;
          user_id: string;
          role: 'host' | 'member';
          joined_at: string;
        };
        Insert: Partial<{
          island_id: string;
          user_id: string;
          role: 'host' | 'member';
          joined_at?: string;
        }>;
        Update: Partial<{
          island_id?: string;
          user_id?: string;
          role?: 'host' | 'member';
          joined_at?: string;
        }>;
        Relationships: [
          {
            foreignKeyName: 'language_island_members_island_id_fkey';
            columns: ['island_id'];
            isOneToOne: false;
            referencedRelation: 'language_islands';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'language_island_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      location_shares: {
        Row: LocationShareRow;
        Insert: Partial<LocationShareRow>;
        Update: Partial<LocationShareRow>;
        Relationships: [];
      };
      decks: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          colour: string;
          icon: string;
          card_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<{
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          colour?: string;
          icon?: string;
          card_count?: number;
          created_at?: string;
          updated_at?: string;
        }>;
        Update: Partial<{
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          colour?: string;
          icon?: string;
          card_count?: number;
          created_at?: string;
          updated_at?: string;
        }>;
        Relationships: [];
      };
      deck_flashcards: {
        Row: {
          id: string;
          deck_id: string;
          flashcard_id: string;
          added_at: string;
        };
        Insert: Partial<{
          id?: string;
          deck_id: string;
          flashcard_id: string;
          added_at?: string;
        }>;
        Update: Partial<{
          id?: string;
          deck_id?: string;
          flashcard_id?: string;
          added_at?: string;
        }>;
        Relationships: [];
      };
      escrow_payments: {
        Row: {
          id: string;
          sender_id: string;
          recipient_id: string;
          amount: number;
          currency: string;
          status: string;
          stripe_payment_intent_id: string | null;
          description: string | null;
          metadata: string | null;
          created_at: string;
          updated_at: string;
          released_at: string | null;
        };
        Insert: Partial<{
          id?: string;
          sender_id: string;
          recipient_id: string;
          amount: number;
          currency: string;
          status?: string;
          stripe_payment_intent_id?: string | null;
          description?: string | null;
          metadata?: string | null;
          created_at?: string;
          updated_at?: string;
          released_at?: string | null;
        }>;
        Update: Partial<{
          sender_id?: string;
          recipient_id?: string;
          amount?: number;
          currency?: string;
          status?: string;
          stripe_payment_intent_id?: string | null;
          description?: string | null;
          metadata?: string | null;
          updated_at?: string;
          released_at?: string | null;
        }>;
        Relationships: [];
      };
      escrow_crash_reports: {
        Row: {
          id: string;
          operation: string;
          escrow_id?: string | null;
          user_id?: string | null;
          error_type: string;
          error_message: string;
          stack_trace?: string | null;
          context?: Record<string, unknown> | null;
          created_at: string;
          acknowledged: boolean;
          resolved_at?: string | null;
        };
        Insert: Partial<{
          id?: string;
          operation: string;
          escrow_id?: string | null;
          user_id?: string | null;
          error_type: string;
          error_message: string;
          stack_trace?: string | null;
          context?: Record<string, unknown> | null;
          acknowledged?: boolean;
          resolved_at?: string | null;
          created_at?: string;
        }>;
        Update: Partial<{
          operation?: string;
          escrow_id?: string | null;
          user_id?: string | null;
          error_type?: string;
          error_message?: string;
          stack_trace?: string | null;
          context?: Record<string, unknown> | null;
          acknowledged?: boolean;
          resolved_at?: string | null;
        }>;
        Relationships: [];
      };
      matchmaking_crash_reports: {
        Row: {
          id: string;
          operation: string;
          user_id: string | null;
          error_type: string;
          error_message: string;
          stack_trace: string | null;
          context: Record<string, unknown> | null;
          circuit_breaker_open: boolean;
          degraded_tier: string | null;
          created_at: string;
          acknowledged: boolean;
          resolved_at: string | null;
        };
        Insert: Partial<{
          id?: string;
          operation: string;
          user_id?: string | null;
          error_type: string;
          error_message: string;
          stack_trace?: string | null;
          context?: Record<string, unknown> | null;
          circuit_breaker_open?: boolean;
          degraded_tier?: string | null;
          created_at?: string;
          acknowledged?: boolean;
          resolved_at?: string | null;
        }>;
        Update: Partial<{
          operation?: string;
          user_id?: string | null;
          error_type?: string;
          error_message?: string;
          stack_trace?: string | null;
          context?: Record<string, unknown> | null;
          circuit_breaker_open?: boolean;
          degraded_tier?: string | null;
          acknowledged?: boolean;
          resolved_at?: string | null;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_xp: {
        Args: { user_id: string; amount: number };
        Returns: void;
      };
      search_nearby_users: {
        Args: {
          search_lat: number;
          search_lon: number;
          radius_m: number;
          exclude_user_id: string | null;
          filter_native_arr: string[] | null;
          filter_target: string | null;
          serious_only: boolean;
          filter_level: string | null;
          filter_gender: string | null;
          filter_age_min: number | null;
          filter_age_max: number | null;
          filter_audio_intro: boolean;
        };
        Returns: unknown[];
      };
      unlock_sticker_pack_atomic: {
        Args: {
          p_user_id: string;
          p_pack_id: string;
        };
        Returns: {
          success: boolean;
          newly_unlocked: boolean;
          coins_remaining: number;
          pack_id: string;
          pack_name: string;
          pack_cost_coins: number;
          pack_is_animated: boolean | null;
          pack_sticker_urls: string[] | null;
          pack_animation_url: string | null;
        }[];
      };
      upsert_reading_progress: {
        Args: {
          p_user_id: string;
          p_resource_id: string;
          p_words_read: number;
          p_duration_seconds: number;
        };
        Returns: void;
      };
    };
    location_shares: {
      Row: LocationShareRow;
      Insert: Partial<LocationShareRow>;
      Update: Partial<LocationShareRow>;
      Relationships: [];
    };
  };
}

@Injectable()
export class SupabaseService implements OnModuleDestroy {
  private readonly client: SupabaseClient<Database>;
  private readonly logger = new Logger(SupabaseService.name);
  private readonly redisClient: Redis;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    const env = this.configService.get<string>('NODE_ENV') || 'development';

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
      );
    }

    if (env === 'production') {
      if (supabaseKey === 'test-service-role-key') {
        throw new Error(
          'SUPABASE_SERVICE_ROLE_KEY must be securely configured in production',
        );
      }
    }
    this.client = createClient<Database>(supabaseUrl, supabaseKey);

    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      // Preserve ioredis 5 response shapes while adopting v6 fixes.
      protocol: 2,
    });
    this.redisClient.on('error', (err) => {
      this.logger.error(
        `Redis connection error in SupabaseService: ${err.message}`,
      );
    });
  }

  getClient(): SupabaseClient<Database> {
    return this.client;
  }

  getRedisClient(): Redis {
    return this.redisClient;
  }

  onModuleDestroy(): void {
    if (this.redisClient) {
      this.redisClient.disconnect();
    }
  }

  async updateLastActivity(userId: string): Promise<void> {
    const supabase = this.getClient();
    // Fetch current study_streak_days and correction_ratio to compute is_serious_learner
    const { data, error: fetchError } = await supabase
      .from('users')
      .select('study_streak_days, correction_ratio')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error(
        `Failed to fetch user data for userId ${userId}:`,
        fetchError.message,
      );
      return;
    }

    const isSeriousLearner =
      (data?.study_streak_days ?? 0) > 7 &&
      (data?.correction_ratio ?? 0) >= 0.8;

    const { error: updateError } = await supabase
      .from('users')
      .update({
        last_active_at: new Date().toISOString(),
        is_serious_learner: isSeriousLearner,
      })
      .eq('id', userId);

    if (updateError) {
      console.error(
        `Failed to update last_active_at for user ${userId}:`,
        updateError.message,
      );
    }
  }

  async incrementXp(userId: string, points: number): Promise<void> {
    const supabase = this.getClient();
    const { error } = await supabase.rpc('increment_xp', {
      user_id: userId,
      amount: points,
    });
    if (error) {
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('xp_total')
        .eq('id', userId)
        .single();
      if (fetchError || !data) {
        console.error(
          `Failed to increment XP for user ${userId}:`,
          error.message ?? fetchError?.message,
        );
        return;
      }
      const row = data;
      const current = (row.xp_total ?? 0) + points;
      await supabase
        .from('users')
        .update({ xp_total: current })
        .eq('id', userId);
    }
  }

  async getUserXp(userId: string): Promise<number> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from('users')
      .select('xp_total')
      .eq('id', userId)
      .single();
    if (error || !data) {
      return 0;
    }
    return Number(data.xp_total ?? 0);
  }

  async isVipUser(userId: string): Promise<boolean> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from('users')
      .select('is_vip')
      .eq('id', userId)
      .single();
    if (error || !data) {
      console.error(
        `Failed to fetch VIP status for user ${userId}:`,
        error?.message,
      );
      return false;
    }
    return data.is_vip ?? false;
  }
}
