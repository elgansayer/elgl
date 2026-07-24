import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { SafetyService } from '../safety/safety.service';
import { CreateCommentDto, CreateMomentDto } from './dto/moment.dto';
import { MomentComment, MomentRecord } from './interfaces/moment.interface';
import { TimelineWorker } from './timeline.worker';
import { MOCK_USERS } from '../mock-data';
import { MomentCommentEvent } from '../notifications/events/notification.events';

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
    private readonly eventEmitter: EventEmitter2,
    private readonly safetyService: SafetyService,
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

    // Get blocked user IDs to exclude from feed
    const blockedIds = await this.safetyService.getBlockedAndBlockerIds(userId);

    if (moments.length === 0) {
      const generated: MomentRecord[] = [];
      const usedUsers = MOCK_USERS.slice(0, 50); // Get 50 fake users
      for (let i = 0; i < usedUsers.length; i++) {
        const u = usedUsers[i];
        // Skip blocked users in mock data
        if (blockedIds.includes(u.id)) continue;
        generated.push({
          id: `mock-moment-${i}`,
          user_id: u.id,
          text_content: `Just practicing my ${u.target_languages[0].toUpperCase()} today! How is everyone doing? Let me know if you want to chat.`,
          media_urls:
            Math.random() > 0.5
              ? [`https://i.pravatar.cc/300?u=moment-${i}`]
              : [],
          media_type: Math.random() > 0.5 ? 'images' : 'none',
          target_language: u.target_languages[0],
          likes_count: Math.floor(Math.random() * 100),
          comments_count: Math.floor(Math.random() * 20),
          is_pinned: false,
          created_at: new Date(
            Date.now() - Math.random() * 86400000 * 3,
          ).toISOString(),
          author: {
            id: u.id,
            display_name: u.display_name,
            avatar_url: u.avatar_url,
          },
          is_liked_by_me: Math.random() > 0.8,
        });
      }

      // Filter the generated mock data same as DB query
      if (filter === 'Classmates' && targetLang) {
        return generated.filter((m) => m.target_language === targetLang);
      }
      return generated.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }

    // Filter out blocked users
    if (blockedIds.length > 0) {
      moments = moments.filter((m) => !blockedIds.includes(m.user_id));
    }

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

    // Check if the moment author has blocked the current user
    const { data: momentData } = await supabase
      .from('moments')
      .select('user_id')
      .eq('id', momentId)
      .single();

    if (momentData) {
      const momentAuthorId = (momentData as { user_id: string }).user_id;
      const blockedIds =
        await this.safetyService.getBlockedAndBlockerIds(momentAuthorId);
      if (blockedIds.includes(userId)) {
        throw new Error('You cannot interact with this moment.');
      }
    }

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

    // Check if the moment author has blocked the current user
    const { data: momentData } = await supabase
      .from('moments')
      .select('user_id')
      .eq('id', momentId)
      .single();

    if (momentData) {
      const momentAuthorId = (momentData as { user_id: string }).user_id;
      const blockedIds =
        await this.safetyService.getBlockedAndBlockerIds(momentAuthorId);
      if (blockedIds.includes(userId)) {
        throw new Error('You cannot comment on this moment.');
      }
    }

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
      .select('comments_count, user_id')
      .eq('id', momentId)
      .single();
    const updatedRow = updatedData as
      (MomentCountRow & { user_id?: string }) | null;
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

    // Emit push notification event
    const momentAuthorId = updatedRow?.user_id;
    if (momentAuthorId && momentAuthorId !== userId) {
      const preview = dto.text_content
        ? dto.text_content.substring(0, 120)
        : dto.correction_payload
          ? `Correction: "${dto.correction_payload.original}" → "${dto.correction_payload.corrected}"`
          : '';

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      this.eventEmitter.emit(
        'moment.comment',
        new MomentCommentEvent(userId, momentAuthorId, momentId, preview),
      );
    }

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
