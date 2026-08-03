// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Global, Injectable, OnModuleDestroy } from '@nestjs/common';
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
  viewer_id?: string;
  created_at: string;
};

type StatusViewRow = {
  id: string;
  viewer_id: string;
  status_owner_id: string;
  created_at: string;
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
  description?: string | null;
  context_url?: string | null;
  created_at?: string;
};

type ChatMessageRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
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
        Row: {
          id: string;
          room_name: string;
          title: string | null;
          host_id: string;
          party_type: string | null;
        };
        Insert: Partial<{
          id?: string;
          room_name: string;
          title?: string | null;
          host_id: string;
          party_type?: string | null;
        }>;
        Update: Partial<{
          id?: string;
          room_name?: string;
          title?: string | null;
          host_id?: string;
          party_type?: string | null;
        }>;
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
        Row: {
          id: string;
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
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
        Row: {
          id: string;
          reporter_id: string;
          reported_user_id: string;
          reason_category: string;
          description?: string | null;
          context_url?: string | null;
          created_at?: string;
        };
        Insert: {
          reporter_id: string;
          reported_user_id: string;
          reason_category: string;
          description?: string | null;
          context_url?: string | null;
          created_at?: string;
          id?: string;
        };
        Update: Partial<{
          reporter_id?: string;
          reported_user_id?: string;
          reason_category?: string;
          description?: string | null;
          context_url?: string | null;
          created_at?: string;
          id?: string;
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

@Global()
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
      .returns<{
        study_streak_days: number | null;
        correction_ratio: number | null;
      }>()
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
        .returns<{ xp_total: number | null }>()
        .single();
      if (fetchError || !data) {
        console.error(
          `Failed to increment XP for user ${userId}:`,
          error.message ?? fetchError?.message,
        );
        return;
      }
      const current = (data.xp_total ?? 0) + points;
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
      .returns<{ xp_total: number | null }>()
      .single();
    if (error || !data) {
      return 0;
    }
    return Number(data.xp_total ?? 0);
  }
}
