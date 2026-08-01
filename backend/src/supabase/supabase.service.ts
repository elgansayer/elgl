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
  [key: string]: unknown;
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
  created_at: string;
};

type MomentRow = {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
};

type MomentCommentRow = {
  id: string;
  author_id: string;
  moment_id: string;
  content: string;
  created_at: string;
};

type MomentLikeRow = {
  id: string;
  user_id: string;
  moment_id: string;
  created_at: string;
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
      chat_messages: {
        Row: ChatMessageRow;
        Insert: Partial<ChatMessageRow>;
        Update: Partial<ChatMessageRow>;
      };
    };
  };
}

@Global()
@Injectable()
export class SupabaseService implements OnModuleDestroy {
  private readonly client: SupabaseClient;
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
    this.client = createClient(supabaseUrl, supabaseKey);

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

  getClient(): SupabaseClient {
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
      .single();
    if (error || !data) {
      return 0;
    }
    return Number(data.xp_total ?? 0);
  }
}
