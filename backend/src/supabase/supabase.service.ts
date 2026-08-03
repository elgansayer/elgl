import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

type UsersRow = {
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
  vip_tier?: string | null;
  updated_at?: string | null;
  target_languages?: string[] | null;
  native_languages?: string[] | null;
  privacy_hide_from_search?: boolean | null;
  incognito_visits?: boolean | null;
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
  serious_learner_mode?: boolean | null;
  notification_preferences?: Record<string, unknown> | null;
};

type GroupsRow = {
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
  created_at: string;
};

type StatusViewRow = {
  id: string;
  viewer_id: string;
  status_owner_id: string;
  status_id?: string | null;
  created_at: string;
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

type UserStickerPackRow = {
  user_id: string;
  pack_id: string;
  created_at?: string;
};

type MomentRow = {
  id: string;
  author_id?: string | null;
  user_id?: string | null;
  content?: string | null;
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
  content: string;
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
  front: string;
  back: string;
  created_at: string;
};

type FavouriteRow = {
  id: string;
  user_id: string;
  moment_id: string;
  created_at: string;
};

type ChatMessageRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
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
      };
      groups: {
        Row: GroupsRow;
        Insert: Partial<GroupsRow>;
        Update: Partial<GroupsRow>;
      };
      group_members: {
        Row: GroupMembersRow;
        Insert: Partial<GroupMembersRow>;
        Update: Partial<GroupMembersRow>;
      };
      group_announcements: {
        Row: GroupAnnouncementsRow;
        Insert: Partial<GroupAnnouncementsRow>;
        Update: Partial<GroupAnnouncementsRow>;
      };
      group_resources: {
        Row: GroupResourcesRow;
        Insert: Partial<GroupResourcesRow>;
        Update: Partial<GroupResourcesRow>;
      };
      interests: {
        Row: InterestsRow;
        Insert: Partial<InterestsRow>;
        Update: Partial<InterestsRow>;
      };
      xp_events: {
        Row: XpEventRow;
        Insert: Partial<XpEventRow>;
        Update: Partial<XpEventRow>;
      };
      user_follows: {
        Row: UserFollowRow;
        Insert: Partial<UserFollowRow>;
        Update: Partial<UserFollowRow>;
      };
      user_profile_likes: {
        Row: UserProfileLikeRow;
        Insert: Partial<UserProfileLikeRow>;
        Update: Partial<UserProfileLikeRow>;
      };
      profile_visits: {
        Row: ProfileVisitRow;
        Insert: Partial<ProfileVisitRow>;
        Update: Partial<ProfileVisitRow>;
      };
      status_views: {
        Row: StatusViewRow;
        Insert: Partial<StatusViewRow>;
        Update: Partial<StatusViewRow>;
      };
      moments: {
        Row: MomentRow;
        Insert: Partial<MomentRow>;
        Update: Partial<MomentRow>;
      };
      moment_comments: {
        Row: MomentCommentRow;
        Insert: Partial<MomentCommentRow>;
        Update: Partial<MomentCommentRow>;
      };
      moment_likes: {
        Row: MomentLikeRow;
        Insert: Partial<MomentLikeRow>;
        Update: Partial<MomentLikeRow>;
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
      };
      favourites: {
        Row: FavouriteRow;
        Insert: Partial<FavouriteRow>;
        Update: Partial<FavouriteRow>;
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
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          new_message: { push: boolean; email: boolean; in_app: boolean };
          call_invite: { push: boolean; email: boolean; in_app: boolean };
          moment_like: { push: boolean; email: boolean; in_app: boolean };
          moment_comment: { push: boolean; email: boolean; in_app: boolean };
          correction: { push: boolean; email: boolean; in_app: boolean };
          gift: { push: boolean; email: boolean; in_app: boolean };
          profile_view: { push: boolean; email: boolean; in_app: boolean };
          study_reminder: { push: boolean; email: boolean; in_app: boolean };
          friend_request: { push: boolean; email: boolean; in_app: boolean };
          audio_room_invite: { push: boolean; email: boolean; in_app: boolean };
          new_follower: { push: boolean; email: boolean; in_app: boolean };
          quiet_hours_start: string | null;
          quiet_hours_end: string | null;
          do_not_disturb: boolean;
          custom_tone_url: string | null;
          vibration_pattern: string | null;
          updated_at: string;
        };
        Insert: Partial<{
          user_id: string;
          new_message?: { push: boolean; email: boolean; in_app: boolean };
          call_invite?: { push: boolean; email: boolean; in_app: boolean };
          moment_like?: { push: boolean; email: boolean; in_app: boolean };
          moment_comment?: { push: boolean; email: boolean; in_app: boolean };
          correction?: { push: boolean; email: boolean; in_app: boolean };
          gift?: { push: boolean; email: boolean; in_app: boolean };
          profile_view?: { push: boolean; email: boolean; in_app: boolean };
          study_reminder?: { push: boolean; email: boolean; in_app: boolean };
          friend_request?: { push: boolean; email: boolean; in_app: boolean };
          audio_room_invite?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
          };
          new_follower?: { push: boolean; email: boolean; in_app: boolean };
          quiet_hours_start?: string | null;
          quiet_hours_end?: string | null;
          do_not_disturb?: boolean;
          custom_tone_url?: string | null;
          vibration_pattern?: string | null;
          updated_at?: string;
        }>;
        Update: Partial<{
          user_id?: string;
          new_message?: { push: boolean; email: boolean; in_app: boolean };
          call_invite?: { push: boolean; email: boolean; in_app: boolean };
          moment_like?: { push: boolean; email: boolean; in_app: boolean };
          moment_comment?: { push: boolean; email: boolean; in_app: boolean };
          correction?: { push: boolean; email: boolean; in_app: boolean };
          gift?: { push: boolean; email: boolean; in_app: boolean };
          profile_view?: { push: boolean; email: boolean; in_app: boolean };
          study_reminder?: { push: boolean; email: boolean; in_app: boolean };
          friend_request?: { push: boolean; email: boolean; in_app: boolean };
          audio_room_invite?: {
            push: boolean;
            email: boolean;
            in_app: boolean;
          };
          new_follower?: { push: boolean; email: boolean; in_app: boolean };
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
          is_online: boolean | null;
          is_pinned: boolean | null;
          is_locked?: boolean | null;
          created_at?: string;
          admin_id?: string;
          invite_code?: string | null;
          is_announcement?: boolean | null;
          max_members?: number;
        };
        Insert: Partial<{
          id?: string;
          title?: string | null;
          is_online?: boolean | null;
          is_pinned?: boolean | null;
          is_locked?: boolean | null;
          created_at?: string;
          admin_id?: string;
          invite_code?: string | null;
          is_announcement?: boolean | null;
          max_members?: number;
        }>;
        Update: Partial<{
          id?: string;
          title?: string | null;
          is_online?: boolean | null;
          is_pinned?: boolean | null;
          is_locked?: boolean | null;
          created_at?: string;
          admin_id?: string;
          invite_code?: string | null;
          is_announcement?: boolean | null;
          max_members?: number;
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
        Relationships: [];
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
    };
    Views: Record<string, never>;
    Functions: {
      increment_xp: {
        Args: { user_id: string; amount: number };
        Returns: void;
      };
    };
  };
}

@Injectable()
export class SupabaseService implements OnModuleDestroy {
  private readonly client: SupabaseClient<Database>;
  private readonly redisClient: Redis;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
      );
    }
    this.client = createClient<Database>(supabaseUrl, supabaseKey);

    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    this.redisClient.on('error', (err) => {
      console.error('Redis connection error in SupabaseService:', err.message);
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
      const row = data as { xp_total: number | null };
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
    const row = data as { is_vip: boolean | null };
    return row.is_vip ?? false;
  }
}
