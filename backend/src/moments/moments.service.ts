import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { CreateCommentDto, CreateMomentDto } from './dto/moment.dto';
import { MomentComment, MomentRecord } from './interfaces/moment.interface';
import { TimelineWorker } from './timeline.worker';

interface UserFollowRow {
  following_id: string;
}

interface UserProfileRow {
  id: string;
  display_name?: string;
  avatar_url?: string | null;
}

interface MomentLikeRow {
  id: string;
  moment_id: string;
}

interface MomentCountRow {
  likes_count?: number;
  comments_count?: number;
}

interface MomentCommentRow {
  id: string;
  moment_id: string;
  user_id: string;
  text_content?: string;
  correction_payload?: {
    original: string;
    corrected: string;
    explanation?: string;
  };
  created_at: string;
}

@Injectable()
export class MomentsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly usersService: UsersService,
    private readonly timelineWorker: TimelineWorker,
  ) {}

  async createMoment(
    userId: string,
    dto: CreateMomentDto,
  ): Promise<MomentRecord> {
    if (dto.media_urls && dto.media_urls.length > 9) {
      throw new BadRequestException(
        'You may upload a maximum of 9 media items per Moment.',
      );
    }

    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('moments')
      .insert({
        user_id: userId,
        text_content: dto.text_content ?? null,
        media_urls: dto.media_urls ?? [],
        media_type: dto.media_type ?? 'none',
        target_language: dto.target_language,
      })
      .select()
      .single();

    if (response.error || !response.data) {
      throw new Error(
        `Failed to create moment: ${response.error?.message ?? 'Unknown error'}`,
      );
    }

    const moment = response.data as MomentRecord;
    // Asynchronous fan-out via Redis timeline queue
    void this.timelineWorker.fanOutMoment(moment.id, userId);

    const profile = await this.usersService.getProfile(userId);
    moment.author = {
      id: profile?.id ?? userId,
      display_name: profile?.display_name ?? 'Serious Learner',
      avatar_url: profile?.avatar_url ?? null,
    };
    moment.is_liked_by_me = false;
    return moment;
  }

  async getFeed(
    userId: string,
    filter: 'All' | 'Classmates' | 'Following',
    targetLang?: string,
  ): Promise<MomentRecord[]> {
    const supabase = this.supabaseService.getClient();
    const redis = this.supabaseService.getRedisClient();

    let moments: MomentRecord[] = [];

    if (filter === 'Following') {
      const queueKey = `timeline_queue:${userId}`;
      const momentIds = await redis.lrange(queueKey, 0, 49);
      if (momentIds.length > 0) {
        const { data } = await supabase
          .from('moments')
          .select('*')
          .in('id', momentIds)
          .order('created_at', { ascending: false });
        if (data) moments = data as MomentRecord[];
      } else {
        // Fallback: get followed users from DB
        const { data: follows } = await supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', userId);
        const followRows = (follows ?? []) as UserFollowRow[];
        const ids = followRows.map((f) => f.following_id);
        ids.push(userId);
        const { data } = await supabase
          .from('moments')
          .select('*')
          .in('user_id', ids)
          .order('created_at', { ascending: false })
          .limit(50);
        if (data) moments = data as MomentRecord[];
      }
    } else if (filter === 'Classmates') {
      const lang = targetLang || 'en';
      const { data } = await supabase
        .from('moments')
        .select('*')
        .eq('target_language', lang)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) moments = data as MomentRecord[];
    } else {
      // All
      const { data } = await supabase
        .from('moments')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) moments = data as MomentRecord[];
    }

    if (moments.length === 0) return [];

    // Hydrate author profiles & likes
    const authorIds = Array.from(new Set(moments.map((m) => m.user_id)));
    const momentIdsList = moments.map((m) => m.id);

    const { data: profiles } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .in('id', authorIds);
    const profileRows = (profiles ?? []) as UserProfileRow[];
    const profileMap = new Map<string, UserProfileRow>();
    profileRows.forEach((p) => profileMap.set(p.id, p));

    const { data: myLikes } = await supabase
      .from('moment_likes')
      .select('moment_id')
      .eq('user_id', userId)
      .in('moment_id', momentIdsList);
    const likeRows = (myLikes ?? []) as MomentLikeRow[];
    const likedSet = new Set<string>(likeRows.map((l) => l.moment_id));

    return moments.map((m) => {
      const p = profileMap.get(m.user_id);
      return {
        ...m,
        author: {
          id: p?.id ?? m.user_id,
          display_name: p?.display_name ?? 'Language Partner',
          avatar_url: p?.avatar_url ?? null,
        },
        is_liked_by_me: likedSet.has(m.id),
      };
    });
  }

  async likeMoment(
    userId: string,
    momentId: string,
  ): Promise<{ likes_count: number; is_liked: boolean }> {
    const supabase = this.supabaseService.getClient();

    const { data: existing } = await supabase
      .from('moment_likes')
      .select('id')
      .eq('moment_id', momentId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      const existingRow = existing as MomentLikeRow;
      await supabase.from('moment_likes').delete().eq('id', existingRow.id);
      const { data: updatedData } = await supabase
        .from('moments')
        .select('likes_count')
        .eq('id', momentId)
        .single();
      const updatedRow = updatedData as MomentCountRow | null;
      const newCount = Math.max(0, (updatedRow?.likes_count ?? 1) - 1);
      await supabase
        .from('moments')
        .update({ likes_count: newCount })
        .eq('id', momentId);
      return { likes_count: newCount, is_liked: false };
    } else {
      await supabase
        .from('moment_likes')
        .insert({ moment_id: momentId, user_id: userId });
      const { data: updatedData } = await supabase
        .from('moments')
        .select('likes_count')
        .eq('id', momentId)
        .single();
      const updatedRow = updatedData as MomentCountRow | null;
      const newCount = (updatedRow?.likes_count ?? 0) + 1;
      await supabase
        .from('moments')
        .update({ likes_count: newCount })
        .eq('id', momentId);
      return { likes_count: newCount, is_liked: true };
    }
  }

  async addComment(
    userId: string,
    momentId: string,
    dto: CreateCommentDto,
  ): Promise<MomentComment> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('moment_comments')
      .insert({
        moment_id: momentId,
        user_id: userId,
        text_content: dto.text_content ?? null,
        correction_payload: dto.correction_payload ?? null,
      })
      .select()
      .single();

    if (response.error || !response.data) {
      throw new Error(
        `Failed to add comment: ${response.error?.message ?? 'Unknown error'}`,
      );
    }

    const { data: updatedData } = await supabase
      .from('moments')
      .select('comments_count')
      .eq('id', momentId)
      .single();
    const updatedRow = updatedData as MomentCountRow | null;
    await supabase
      .from('moments')
      .update({ comments_count: (updatedRow?.comments_count ?? 0) + 1 })
      .eq('id', momentId);

    const comment = response.data as MomentComment;
    const profile = await this.usersService.getProfile(userId);
    comment.author = {
      id: profile?.id ?? userId,
      display_name: profile?.display_name ?? 'Serious Learner',
      avatar_url: profile?.avatar_url ?? null,
    };
    return comment;
  }

  async getComments(momentId: string): Promise<MomentComment[]> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from('moment_comments')
      .select('*')
      .eq('moment_id', momentId)
      .order('created_at', { ascending: true });

    if (!data || data.length === 0) return [];

    const commentRows = data as MomentCommentRow[];
    const authorIds = Array.from(new Set(commentRows.map((c) => c.user_id)));
    const { data: profiles } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .in('id', authorIds);
    const profileRows = (profiles ?? []) as UserProfileRow[];
    const profileMap = new Map<string, UserProfileRow>();
    profileRows.forEach((p) => profileMap.set(p.id, p));

    return commentRows.map((c) => {
      const p = profileMap.get(c.user_id);
      return {
        id: c.id,
        moment_id: c.moment_id,
        user_id: c.user_id,
        text_content: c.text_content,
        correction_payload: c.correction_payload,
        created_at: c.created_at,
        author: {
          id: p?.id ?? c.user_id,
          display_name: p?.display_name ?? 'Language Partner',
          avatar_url: p?.avatar_url ?? null,
        },
      };
    });
  }

  async pinMoment(
    userId: string,
    isVip: boolean,
    momentId: string,
  ): Promise<MomentRecord> {
    if (!isVip) {
      throw new ForbiddenException(
        'Moment pinning is exclusively available to VIP subscribers (8 UKP / $10 USD per month). Upgrade now to pin highlights to the top of the feed!',
      );
    }

    const supabase = this.supabaseService.getClient();
    const { data: momentData } = await supabase
      .from('moments')
      .select('user_id, is_pinned')
      .eq('id', momentId)
      .single();
    if (!momentData) {
      throw new ForbiddenException('Moment not found.');
    }
    const momentRow = momentData;
    if (momentRow.user_id !== userId) {
      throw new ForbiddenException('You can only pin your own Moments.');
    }

    const response = await supabase
      .from('moments')
      .update({ is_pinned: !momentRow.is_pinned })
      .eq('id', momentId)
      .select()
      .single();

    if (response.error || !response.data) {
      throw new Error(
        `Failed to toggle pin: ${response.error?.message ?? 'Unknown error'}`,
      );
    }

    return response.data as MomentRecord;
  }
}
