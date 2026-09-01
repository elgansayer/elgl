import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { SafetyService } from '../safety/safety.service';
import { XpService } from '../xp/xp.service';
import { QuestsService } from '../quests/quests.service';
import { CreateCommentDto, CreateMomentDto } from './dto/moment.dto';
import { CreateLanguageQuestionDto } from './dto/create-language-question.dto';
import { CreateStoryDto } from './dto/create-story.dto';
import { EditTextDto } from './dto/edit-text.dto';
import { MomentComment, MomentRecord } from './interfaces/moment.interface';
import { StoryResponse } from './interfaces/story.interface';
import { TimelineWorker } from './timeline.worker';
import { MOCK_USERS } from '../mock-data';
import { MomentCommentEvent } from '../notifications/events/notification.events';
import { R2Service } from '../cloudflare-r2/r2.service';

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

export interface MomentLikeUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
  native_languages?: string[];
  target_languages: string[];
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
  async getLifetimeCounts(_userId?: string): Promise<{
    translations: number;
    corrections: number;
    moments: number;
  }> {
    void _userId;
    const supabase = this.supabaseService.getClient();

    // ⚡ Bolt Optimization: Replace sequential awaits with Promise.all mapped concurrent operations
    const [
      { data: momentsData, error: momentsError },
      { data: correctionsData, error: correctionsError },
      { data: translationsData, error: translationsError },
    ] = await Promise.all([
      supabase.from('moments').select('id'),
      supabase
        .from('moment_comments')
        .select('id')
        .not('correction_payload', 'is', null),
      supabase.from('translations').select('id'),
    ]);

    if (momentsError || correctionsError || translationsError) {
      throw new Error(
        `Failed to fetch counts: ${momentsError?.message ?? ''} ${correctionsError?.message ?? ''} ${translationsError?.message ?? ''}`,
      );
    }

    return {
      translations: translationsData?.length ?? 0,
      corrections: correctionsData?.length ?? 0,
      moments: momentsData?.length ?? 0,
    };
  }
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly usersService: UsersService,
    private readonly xpService: XpService,
    private readonly questsService: QuestsService,
    private readonly timelineWorker: TimelineWorker,
    private readonly eventEmitter: EventEmitter2,
    private readonly safetyService: SafetyService,
    private readonly r2Service: R2Service,
  ) {}

  private inferMediaType(dto: CreateStoryDto): string {
    if (dto.media_type) {
      return dto.media_type;
    }
    if (dto.voice_note_url) {
      return 'audio';
    }
    const urls = dto.media_urls ?? [];
    if (urls.length > 0) {
      const isVideo = urls.some((u) =>
        /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i.test(u),
      );
      return isVideo ? 'video' : 'images';
    }
    return 'none';
  }

  async createStory(
    userId: string,
    dto: CreateStoryDto,
  ): Promise<StoryResponse> {
    const supabase = this.supabaseService.getClient();

    // Calculate expires_at (default 24 hours)
    const expireHours = dto.expireInHours ?? 24;
    const expiresAt = new Date(
      Date.now() + expireHours * 3600 * 1000,
    ).toISOString();

    const mediaType = this.inferMediaType(dto);
    const { data, error } = (await supabase
      .from('moments')
      .insert({
        user_id: userId,
        text_content: dto.text_content ?? null,
        media_urls: dto.media_urls ?? [],
        media_type: mediaType,
        target_language: dto.target_language ?? null,
        voice_note_url: dto.voice_note_url ?? null,
        is_ephemeral: true,
        expires_at: expiresAt,
      })
      .select()
      .single()) as unknown as {
      data: {
        id: string;
        user_id: string;
        text_content: string | null;
        media_urls: string[];
        media_type: string;
        voice_note_url: string | null;
        target_language: string | null;
        expires_at: string;
        created_at: string;
      } | null;
      error: { message?: string } | null;
    };

    if (error || !data) {
      throw new Error(
        `Failed to create story: ${error?.message ?? 'Unknown error'}`,
      );
    }

    const profile = await this.usersService.getProfile(userId);

    return {
      id: data.id,
      user_id: data.user_id,
      text_content: data.text_content,
      media_urls: data.media_urls ?? [],
      media_type: data.media_type,
      voice_note_url: data.voice_note_url ?? null,
      target_language: data.target_language,
      expires_at: data.expires_at,
      created_at: data.created_at,
      author: {
        id: profile?.id ?? userId,
        display_name: profile?.display_name ?? 'Serious Learner',
        avatar_url: profile?.avatar_url ?? null,
      },
    };
  }

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
    const response = (await supabase
      .from('moments')
      .insert({
        user_id: userId,
        text_content: dto.text_content ?? null,
        media_urls: dto.media_urls ?? [],
        media_type: dto.media_type ?? 'none',
        target_language: dto.target_language,
        post_type: dto.post_type ?? 'moment',
        question_text: dto.question_text ?? null,
        question_options: dto.question_options ?? [],
        correct_answer: dto.correct_answer ?? null,
        voice_note_url: dto.voice_note_url ?? null,
      })
      .select()
      .single()) as unknown as {
      data: MomentRecord | null;
      error: { message?: string } | null;
    };

    if (response.error || !response.data) {
      throw new Error(
        `Failed to create moment: ${response.error?.message ?? 'Unknown error'}`,
      );
    }

    const moment = response.data as MomentRecord & { post_type?: string };
    moment.post_type = dto.post_type ?? 'moment';
    moment.media_type = dto.media_type ?? 'none';
    if (!moment.correct_answers_count) moment.correct_answers_count = 0;
    if (!moment.total_answers_count) moment.total_answers_count = 0;
    // Award XP for creating a Moment
    void this.xpService.awardXpForActivity(userId, 'create_moment');
    // Award quest progress for posting a Moment
    void this.questsService.incrementProgress(userId, 'post_moment', 1);
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

  async createLanguageQuestion(
    userId: string,
    dto: CreateLanguageQuestionDto,
  ): Promise<MomentRecord> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = (await supabase
      .from('moments')
      .insert({
        user_id: userId,
        text_content: dto.text_content ?? null,
        media_urls: [],
        media_type: 'none',
        target_language: dto.target_language,
        post_type: 'language_question',
        question_text: dto.question_text,
        question_options: dto.question_options,
        correct_answer: dto.correct_answer,
      })
      .select()
      .single()) as unknown as {
      data: MomentRecord | null;
      error?: { message?: string } | null;
    };

    if (error || !data) {
      throw new Error(
        `Failed to create language question: ${error?.message ?? 'Unknown error'}`,
      );
    }
    const moment = data as MomentRecord & { post_type?: string };
    moment.post_type = 'language_question';
    moment.media_type = 'none';
    moment.is_pinned = false;
    moment.likes_count = 0;
    moment.comments_count = 0;
    moment.correct_answers_count = 0;
    moment.total_answers_count = 0;
    void this.xpService.awardXpForActivity(userId, 'create_moment');
    void this.questsService.incrementProgress(userId, 'post_moment', 1);
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
    filter: 'All' | 'Classmates' | 'Following' | 'For You',
    targetLang?: string,
  ): Promise<MomentRecord[]> {
    const supabase = this.supabaseService.getClient();
    const redis = this.supabaseService.getRedisClient();

    // 1) Get blocked+blocker user IDs (bidirectional)
    const blockedIds = await this.safetyService.getBlockedAndBlockerIds(userId);

    // 2) Get current user's native language for targeted visibility routing
    const profile = await this.usersService.getProfile(userId);
    const userNativeLang = profile?.native_languages?.[0] ?? null;

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
        if (data) moments = data as unknown as MomentRecord[];
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
        if (data) moments = data as unknown as MomentRecord[];
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
      if (data) moments = data as unknown as MomentRecord[];
    } else if (filter === 'For You') {
      const { data } = await supabase
        .from('moments')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);
      if (data) {
        moments = (data as unknown as MomentRecord[])
          .sort((a, b) => {
            const scoreA =
              (a.likes_count || 0) * 2 + (a.comments_count || 0) * 3;
            const scoreB =
              (b.likes_count || 0) * 2 + (b.comments_count || 0) * 3;
            return scoreB - scoreA;
          })
          .slice(0, 50);
      }
    } else {
      // All
      const { data } = await supabase
        .from('moments')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) moments = data as unknown as MomentRecord[];
    }

    // Exclude ephemeral stories (they should only be visible via the stories endpoint)
    moments = moments.filter((m) => !m.is_ephemeral);
    // Exclude post types that are not regular moments (questions/language questions)
    moments = moments.filter((m) => !m.post_type || m.post_type === 'moment');

    // Apply targeted visibility for non-Classmates filters: only show moments
    // whose target_language matches the current user's native language.
    if (filter !== 'Classmates' && userNativeLang) {
      moments = moments.filter(
        (m) =>
          !m.target_language ||
          m.target_language.toLowerCase() === userNativeLang,
      );
    }

    // Filter out blocked users
    if (blockedIds.length > 0) {
      moments = moments.filter((m) => !blockedIds.includes(m.user_id));
    }

    if (moments.length === 0) {
      let generated: MomentRecord[] = [];
      const eligibleUsers = MOCK_USERS.filter(
        (u) => !blockedIds.includes(u.id),
      );
      for (let i = 0; i < Math.min(eligibleUsers.length, 50); i++) {
        const u = eligibleUsers[i];
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
        return generated.filter(
          (m) => m.target_language.toLowerCase() === targetLang.toLowerCase(),
        );
      }
      // Targeted visibility for non-Classmates filters: only show moments
      // whose target_language matches the current user's native language.
      if (filter !== 'Classmates' && userNativeLang) {
        generated = generated.filter(
          (m) =>
            !m.target_language ||
            m.target_language.toLowerCase() === userNativeLang,
        );
      }
      return generated.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }

    // Hydrate author profiles & likes
    const authorIds = Array.from(new Set(moments.map((m) => m.user_id)));
    const momentIdsList = moments.map((m) => m.id);

    const profilesResponse = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .in('id', authorIds);
    const profiles = profilesResponse.data as UserProfileRow[] | null;
    const profileRows = profiles ?? [];
    const profileMap = new Map<string, UserProfileRow>();
    profileRows.forEach((p) => profileMap.set(p.id, p));

    const likesResponse = await supabase
      .from('moment_likes')
      .select('moment_id')
      .eq('user_id', userId)
      .in('moment_id', momentIdsList);
    const myLikes = likesResponse.data as MomentLikeRow[] | null;
    const likeRows = myLikes ?? [];
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

  async getQuestions(
    userId: string,
    targetLang?: string,
  ): Promise<MomentRecord[]> {
    const supabase = this.supabaseService.getClient();
    const blockedIds = await this.safetyService.getBlockedAndBlockerIds(userId);

    let query = supabase
      .from('moments')
      .select('*')
      .in('post_type', ['question', 'language_question'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (targetLang) {
      query = query.eq('target_language', targetLang);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch questions: ${error.message}`);
    }

    let moments: MomentRecord[] = (data ?? []) as unknown as MomentRecord[];

    if (blockedIds.length > 0) {
      moments = moments.filter((m) => !blockedIds.includes(m.user_id));
    }

    if (moments.length === 0) {
      const generated: MomentRecord[] = [];
      const eligibleUsers = MOCK_USERS.filter(
        (u) => !blockedIds.includes(u.id),
      );
      for (let i = 0; i < Math.min(eligibleUsers.length, 50); i++) {
        const u = eligibleUsers[i];
        generated.push({
          id: `mock-question-${i}`,
          user_id: u.id,
          text_content: undefined,
          media_urls: [],
          media_type: 'none',
          target_language: targetLang ?? u.target_languages[0],
          post_type: 'question',
          question_text: `What does "${['bonjour', 'gracias', 'danke', 'arigato'][i % 4]}" mean? Can anyone help?`,
          question_options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correct_answer: 'Option A',
          likes_count: Math.floor(Math.random() * 50),
          comments_count: Math.floor(Math.random() * 15),
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
      return generated.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }

    const authorIds = Array.from(new Set(moments.map((m) => m.user_id)));
    const momentIdsList = moments.map((m) => m.id);

    const profilesResponse = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .in('id', authorIds);
    const profiles = profilesResponse.data as UserProfileRow[] | null;
    const profileMap = new Map<string, UserProfileRow>();
    (profiles ?? []).forEach((p) => profileMap.set(p.id, p));

    const likesResponse = await supabase
      .from('moment_likes')
      .select('moment_id')
      .eq('user_id', userId)
      .in('moment_id', momentIdsList);
    const myLikes = likesResponse.data as MomentLikeRow[] | null;
    const likedSet = new Set<string>((myLikes ?? []).map((l) => l.moment_id));

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

  async getActiveStories(userId: string): Promise<MomentRecord[]> {
    const supabase = this.supabaseService.getClient();

    // Get IDs of users the current user follows, plus self
    const { data: follows, error: followsError } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', userId);

    if (followsError) {
      throw new Error(`Failed to fetch follows: ${followsError.message}`);
    }

    const followRows = (follows ?? []) as UserFollowRow[];
    const storyUserIds = followRows.map((f) => f.following_id);
    storyUserIds.push(userId);

    const { data, error } = await supabase
      .from('moments')
      .select('*')
      .eq('is_ephemeral', true)
      .gt('expires_at', new Date().toISOString())
      .in('user_id', storyUserIds)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Failed to fetch stories: ${error.message}`);
    }

    let stories = (data ?? []) as MomentRecord[];
    const blockedIds = await this.safetyService.getBlockedAndBlockerIds(userId);

    // Include mock stories if there are none
    if (stories.length === 0) {
      const eligibleUsers = MOCK_USERS.filter(
        (u) => !blockedIds.includes(u.id),
      );
      const generated: MomentRecord[] = [];
      for (let i = 0; i < Math.min(eligibleUsers.length, 50); i++) {
        const u = eligibleUsers[i];
        generated.push({
          id: `mock-story-${i}`,
          user_id: u.id,
          text_content: `Just sharing my language learning update for today!`,
          media_urls: [],
          media_type: 'none',
          target_language: 'en',
          likes_count: 0,
          comments_count: 0,
          is_pinned: false,
          created_at: new Date(
            Date.now() - Math.random() * 86400000,
          ).toISOString(),
          author: {
            id: u.id,
            display_name: u.display_name,
            avatar_url: u.avatar_url,
          },
          is_liked_by_me: false,
        });
      }
      return generated;
    }

    // Fetch status visibility for authors (privacy control)
    if (stories.length > 0) {
      const storyAuthorIds = Array.from(new Set(stories.map((s) => s.user_id)));
      const { data: visRowsData, error: visErr } = await supabase
        .from('users')
        .select('id, status_visibility')
        .in('id', storyAuthorIds);

      if (visErr) {
        throw new Error(`Failed to fetch status visibility: ${visErr.message}`);
      }

      const visMap = new Map<string, string>();
      const visRows = (visRowsData ?? []) as Array<{
        id: string;
        status_visibility?: string;
      }>;
      visRows.forEach((row) => {
        visMap.set(row.id, row.status_visibility ?? 'public');
      });

      stories = stories.filter((s) => {
        const vis = visMap.get(s.user_id) ?? 'public';
        if (s.user_id === userId) return true;
        if (vis === 'only_me') return false;
        // 'public' and 'followers' are both allowed because we only
        // fetched stories from users the current user follows (plus self).
        return true;
      });
    }

    // Filter out blocked users
    if (blockedIds.length > 0) {
      stories = stories.filter((s) => !blockedIds.includes(s.user_id));
    }

    // Hydrate author profiles
    const authorIds = Array.from(new Set(stories.map((s) => s.user_id)));
    const profilesResponse = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .in('id', authorIds);
    const profiles = profilesResponse.data as UserProfileRow[] | null;
    const profileMap = new Map<string, UserProfileRow>();
    (profiles ?? []).forEach((p) => profileMap.set(p.id, p));

    return stories.map((s) => {
      const p = profileMap.get(s.user_id);
      return {
        ...s,
        author: {
          id: p?.id ?? s.user_id,
          display_name: p?.display_name ?? 'Language Partner',
          avatar_url: p?.avatar_url ?? null,
        },
        is_liked_by_me: false,
      };
    });
  }

  async answerLanguageQuestion(
    userId: string,
    momentId: string,
    answer: string,
  ): Promise<{ correct: boolean; correctAnswer: string }> {
    const supabase = this.supabaseService.getClient();

    const { data: momentData, error: fetchError } = await supabase
      .from('moments')
      .select(
        'user_id, post_type, correct_answer, question_options, question_text',
      )
      .eq('id', momentId)
      .single();

    if (fetchError || !momentData) {
      throw new Error('Moment not found');
    }

    const moment = momentData as {
      user_id: string;
      post_type?: string;
      correct_answer?: string;
      question_options?: string[];
      question_text?: string;
    };

    if (moment.post_type !== 'language_question') {
      throw new BadRequestException('Only language questions can be answered.');
    }

    const correct = moment.correct_answer === answer;

    try {
      const { error: insertError } = await supabase
        .from('moment_question_answers')
        .insert({
          moment_id: momentId,
          user_id: userId,
          answer,
          is_correct: correct,
        });
      if (insertError) {
        // ignore; table may not exist in some environments
      }
    } catch {
      // ignore
    }

    const { data: rows, error: countError } = await supabase
      .from('moment_question_answers')
      .select('is_correct')
      .eq('moment_id', momentId)
      .returns<Array<{ is_correct: boolean }>>();

    if (!countError && rows) {
      const total = rows.length;
      const correctCount = rows.filter((r) => r.is_correct).length;
      await supabase
        .from('moments')
        .update({
          correct_answers_count: correctCount,
          total_answers_count: total,
        })
        .eq('id', momentId);
    }

    return { correct, correctAnswer: moment.correct_answer ?? '' };
  }

  async likeMoment(
    userId: string,
    momentId: string,
  ): Promise<{ likes_count: number; is_liked: boolean }> {
    const supabase = this.supabaseService.getClient();

    // Check if the moment author has blocked the current user
    const momentResponse = (await supabase
      .from('moments')
      .select('user_id')
      .eq('id', momentId)
      .single()) as unknown as {
      data: { user_id: string } | null;
      error: { message?: string } | null;
    };

    const momentData = momentResponse.data;

    if (momentData) {
      const momentAuthorId = momentData.user_id;
      const blockedIds =
        await this.safetyService.getBlockedAndBlockerIds(momentAuthorId);
      if (blockedIds.includes(userId)) {
        throw new Error('You cannot interact with this moment.');
      }
    }

    const existingResponse = await supabase
      .from('moment_likes')
      .select('id')
      .eq('moment_id', momentId)
      .eq('user_id', userId)
      .single();

    const existing = existingResponse.data as MomentLikeRow | null;

    if (existing) {
      const existingRow = existing;
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
      const result = await supabase
        .from('moments')
        .select('likes_count')
        .eq('id', momentId)
        .single();
      const updatedRow = result.data as MomentCountRow | null;
      const newCount = (updatedRow?.likes_count ?? 0) + 1;
      await supabase
        .from('moments')
        .update({ likes_count: newCount })
        .eq('id', momentId);
      return { likes_count: newCount, is_liked: true };
    }
  }

  async getMomentLikes(
    momentId: string,
    currentUserId?: string,
  ): Promise<MomentLikeUser[]> {
    const supabase = this.supabaseService.getClient();

    const blockedIds = currentUserId
      ? await this.safetyService.getBlockedAndBlockerIds(currentUserId)
      : [];

    type MomentLikeQueryResult = {
      user_id: string;
      created_at: string;
      users: MomentLikeUser | null;
    };
    const { data, error } = await supabase
      .from('moment_likes')
      .select(
        `
        user_id,
        created_at,
        users (
          id,
          display_name,
          avatar_url,
          native_languages,
          target_languages
        )
      `,
      )
      .eq('moment_id', momentId)
      .order('created_at', { ascending: false })
      .returns<MomentLikeQueryResult[]>();

    if (error) {
      throw new Error(`Failed to fetch likes: ${error.message}`);
    }

    const rows = data ?? [];
    const fullUsers = rows
      .map((row) => row.users)
      .filter((user): user is MomentLikeUser => Boolean(user));

    // Filter out blocked users
    if (blockedIds.length > 0) {
      return fullUsers.filter((user) => !blockedIds.includes(user.id));
    }

    return fullUsers;
  }

  async addComment(
    userId: string,
    momentId: string,
    dto: CreateCommentDto,
  ): Promise<MomentComment> {
    const supabase = this.supabaseService.getClient();

    // Check if the moment author has blocked the current user
    const momentResponse = (await supabase
      .from('moments')
      .select('user_id')
      .eq('id', momentId)
      .single()) as unknown as {
      data: { user_id: string } | null;
      error: { message?: string } | null;
    };

    const momentData = momentResponse.data;

    if (momentData) {
      const momentAuthorId = momentData.user_id;
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
        parent_comment_id: dto.parent_comment_id ?? null,
        reply_to_user_id: dto.reply_to_user_id ?? null,
      })
      .select()
      .single();

    if (response.error || !response.data) {
      throw new Error(
        `Failed to add comment: ${response.error?.message ?? 'Unknown error'}`,
      );
    }

    const comment = response.data as MomentComment;

    // Award XP for adding a comment
    void this.xpService.awardXpForActivity(userId, 'add_comment');

    // Award quest progress when the comment contains a correction payload
    if (dto.correction_payload) {
      void this.questsService.incrementProgress(userId, 'correct_moments', 1);
    }

    const result = await supabase
      .from('moments')
      .select('comments_count, user_id')
      .eq('id', momentId)
      .single();

    const updatedData = result.data as
      (MomentCountRow & { user_id?: string }) | null;

    await supabase
      .from('moments')
      .update({ comments_count: (updatedData?.comments_count ?? 0) + 1 })
      .eq('id', momentId);

    const profile = await this.usersService.getProfile(userId);
    comment.author = {
      id: profile?.id ?? userId,
      display_name: profile?.display_name ?? 'Serious Learner',
      avatar_url: profile?.avatar_url ?? null,
    };

    const payload = dto.correction_payload as
      | { original: string; corrected: string; explanation?: string }
      | null
      | undefined;
    const preview = dto.text_content
      ? dto.text_content.substring(0, 120)
      : payload
        ? `Correction: "${payload.original}" → "${payload.corrected}"`
        : '';

    // Emit push notification event to the moment author
    const momentAuthorId = updatedData?.user_id;
    if (momentAuthorId && momentAuthorId !== userId) {
      this.eventEmitter.emit(
        'moment.comment',
        new MomentCommentEvent(
          momentId,
          userId,
          momentAuthorId,
          preview,
          dto.parent_comment_id,
          dto.reply_to_user_id,
        ),
      );
    }

    // Parse @mentions and emit notifications
    if (dto.text_content) {
      const mentionRegex = /@([\wÀ-ɏ؀-ۿ]+)/g;
      const matches = [...dto.text_content.matchAll(mentionRegex)];
      const mentionedNames = matches.map((m) => m[1]);

      if (mentionedNames.length > 0) {
        const { data } = await supabase
          .from('users')
          .select('id, display_name')
          .in('display_name', mentionedNames);
        const mentionedUsers = data as UserProfileRow[] | null;

        if (mentionedUsers) {
          const mentionedUserIds = mentionedUsers
            .filter((u) => u.id !== userId && u.id !== momentAuthorId)
            .map((u) => u.id);

          if (mentionedUserIds.length > 0) {
            this.eventEmitter.emit(
              'moment.mention',
              new MomentCommentEvent(
                momentId,
                userId,
                momentAuthorId ?? '',
                preview,
                dto.parent_comment_id,
                dto.reply_to_user_id,
                mentionedUserIds,
              ),
            );
          }
        }
      }
    }

    return comment;
  }

  async getComments(
    momentId: string,
    currentUserId?: string,
  ): Promise<MomentComment[]> {
    const supabase = this.supabaseService.getClient();

    const blockedIds = currentUserId
      ? await this.safetyService.getBlockedAndBlockerIds(currentUserId)
      : [];

    const { data } = await supabase
      .from('moment_comments')
      .select('*')
      .eq('moment_id', momentId)
      .order('created_at', { ascending: true });

    if (!data || data.length === 0) return [];

    let commentRows = data as MomentCommentRow[];

    // Filter out comments from blocked users
    if (blockedIds.length > 0) {
      commentRows = commentRows.filter((c) => !blockedIds.includes(c.user_id));
    }

    const authorIds = Array.from(new Set(commentRows.map((c) => c.user_id)));
    const commentIds = commentRows.map((c) => c.id);

    // ⚡ Bolt Optimization: Group independent database lookups with a single concurrent Promise.all batch fetch to mitigate additive network latency.
    const [profilesResponse, { data: votesData }] = await Promise.all([
      supabase
        .from('users')
        .select('id, display_name, avatar_url')
        .in('id', authorIds),
      supabase
        .from('moment_comment_votes')
        .select('comment_id, user_id, vote')
        .in('comment_id', commentIds),
    ]);

    const profiles = profilesResponse.data as UserProfileRow[] | null;
    const profileRows = profiles ?? [];
    const profileMap = new Map<string, UserProfileRow>();
    profileRows.forEach((p) => profileMap.set(p.id, p));

    // Fetch vote data for these comments

    const votesMap = new Map<string, { up: number; down: number }>();
    const myVotesMap = new Map<string, string>();

    for (const row of votesData ?? []) {
      const r = row;
      const entry = votesMap.get(r.comment_id) ?? { up: 0, down: 0 };
      if (r.vote === 'up') entry.up++;
      else if (r.vote === 'down') entry.down++;
      votesMap.set(r.comment_id, entry);
      if (currentUserId && r.user_id === currentUserId) {
        myVotesMap.set(r.comment_id, r.vote);
      }
    }

    return commentRows.map((c) => {
      const p = profileMap.get(c.user_id);
      const v = votesMap.get(c.id) ?? { up: 0, down: 0 };
      return {
        id: c.id,
        moment_id: c.moment_id,
        user_id: c.user_id,
        text_content: c.text_content,
        correction_payload: c.correction_payload,
        created_at: c.created_at,
        upVotes: v.up,
        downVotes: v.down,
        userVote: currentUserId ? (myVotesMap.get(c.id) ?? null) : undefined,
        author: {
          id: p?.id ?? c.user_id,
          display_name: p?.display_name ?? 'Language Partner',
          avatar_url: p?.avatar_url ?? null,
        },
      };
    });
  }

  async getVoiceUploadUrl(
    userId: string,
    filename: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    const profile = await this.usersService.getProfile(userId);
    if (!profile?.is_vip) {
      throw new ForbiddenException(
        'Voice notes are only available for VIP subscribers (8 UKP / $10 USD per month).',
      );
    }
    return await this.r2Service.generateUploadUrl(filename, contentType);
  }

  async getMediaUploadUrl(
    filename: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    return await this.r2Service.generateUploadUrl(filename, contentType);
  }

  async editMomentText(
    userId: string,
    momentId: string,
    dto: EditTextDto,
  ): Promise<MomentRecord> {
    const supabase = this.supabaseService.getClient();

    // Retrieve the moment to verify existence and author
    const { data: momentData, error: fetchErr } = await supabase
      .from('moments')
      .select('user_id, text_content')
      .eq('id', momentId)
      .single();

    if (fetchErr || !momentData) {
      throw new Error('Moment not found');
    }

    const momentAuthorId = (momentData as unknown as { user_id: string })
      .user_id;

    // Check if the editor is blocked by the moment author
    const blockedIds =
      await this.safetyService.getBlockedAndBlockerIds(momentAuthorId);
    if (blockedIds.includes(userId)) {
      throw new Error('You cannot edit this moment.');
    }

    // Update the text content
    const { error: updateErr } = await supabase
      .from('moments')
      .update({ text_content: dto.textContent })
      .eq('id', momentId);

    if (updateErr) {
      throw new Error(`Failed to edit moment text: ${updateErr.message}`);
    }

    // Return the updated moment
    const { data: updated, error: getErr } = await supabase
      .from('moments')
      .select('*')
      .eq('id', momentId)
      .single();

    if (getErr || !updated) {
      throw new Error('Failed to retrieve updated moment');
    }

    const momentRecord = updated as MomentRecord;
    const profile = await this.usersService.getProfile(userId);
    momentRecord.author = {
      id: profile?.id ?? userId,
      display_name: profile?.display_name ?? 'Language Partner',
      avatar_url: profile?.avatar_url ?? null,
    };
    momentRecord.is_liked_by_me = false;
    return momentRecord;
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
    const momentResponse = (await supabase
      .from('moments')
      .select('user_id, is_pinned')
      .eq('id', momentId)
      .single()) as unknown as {
      data: { user_id: string; is_pinned: boolean } | null;
      error: { message?: string } | null;
    };

    const momentData = momentResponse.data;

    if (!momentData) {
      throw new ForbiddenException('Moment not found.');
    }
    if (momentData.user_id !== userId) {
      throw new ForbiddenException('You can only pin your own Moments.');
    }

    const response = await supabase
      .from('moments')
      .update({ is_pinned: !momentData.is_pinned })
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

  async voteOnCorrection(
    userId: string,
    commentId: string,
    vote: 'up' | 'down',
  ): Promise<{
    commentId: string;
    vote: string;
    upVotes: number;
    downVotes: number;
    userVote: string | null;
  }> {
    const supabase = this.supabaseService.getClient();

    // Verify comment exists
    const { data: commentData, error: commentErr } = await supabase
      .from('moment_comments')
      .select('id, user_id')
      .eq('id', commentId)
      .single();

    if (commentErr || !commentData) {
      throw new Error('Comment not found');
    }

    // Fetch existing vote from this user
    const { data: existingVote } = await supabase
      .from('moment_comment_votes')
      .select('id, vote')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .single();

    if (existingVote) {
      const currentVoteValue = existingVote.vote as 'up' | 'down';
      if (currentVoteValue === vote) {
        // Same vote: remove (toggle off)
        await supabase
          .from('moment_comment_votes')
          .delete()
          .eq('id', existingVote.id);
      } else {
        // Opposite vote: update
        await supabase
          .from('moment_comment_votes')
          .update({ vote })
          .eq('id', existingVote.id);
      }
    } else {
      // No previous vote: insert
      await supabase.from('moment_comment_votes').insert({
        comment_id: commentId,
        user_id: userId,
        vote,
      });
    }

    // Count votes for this comment
    const { data: votes } = await supabase
      .from('moment_comment_votes')
      .select('vote')
      .eq('comment_id', commentId);

    const voteRows = (votes ?? []) as Array<{ vote: 'up' | 'down' }>;
    const upVotes = voteRows.filter((v) => v.vote === 'up').length;
    const downVotes = voteRows.filter((v) => v.vote === 'down').length;

    // Determine current user's vote after toggle
    const { data: myVote } = await supabase
      .from('moment_comment_votes')
      .select('vote')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .single();

    const userVote: string | null = myVote?.vote ?? null;

    return {
      commentId,
      vote: userVote ?? '',
      upVotes,
      downVotes,
      userVote,
    };
  }
}
