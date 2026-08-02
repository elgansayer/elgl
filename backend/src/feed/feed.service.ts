import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyService } from '../safety/safety.service';

// Define Moment interface locally to avoid import issues
export interface Moment {
  id: string;
  author_id: string;
  content_text?: string | null;
  media_urls?: string[];
  voice_note_url?: string | null;
  detected_language?: string | null;
  is_pinned: boolean;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author?: {
    id: string;
    display_name: string;
    avatar_url?: string | null;
    native_languages?: string[];
    target_languages?: string[];
  } | null;
}

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly safetyService: SafetyService,
  ) {}

  async getFeed(
    currentUserId: string,
    filter?: 'all' | 'classmates' | 'following',
  ): Promise<Moment[]> {
    const supabase = this.supabaseService.getClient();

    // When serious_learner_mode is active, return empty feed immediately
    const { data: profileData } = await supabase
      .from('users')
      .select('serious_learner_mode')
      .eq('id', currentUserId)
      .single();
    if (profileData && (profileData as any).serious_learner_mode === true) {
      return [];
    }

    // Get blocked AND blocker user IDs to exclude from feed
    const blockedIds: string[] =
      await this.safetyService.getBlockedAndBlockerIds(currentUserId);

    let query = supabase
      .from('moments')
      .select(
        `
        *,
        author:users!moments_author_id_fkey (
          id,
          display_name,
          avatar_url,
          native_languages,
          target_languages
        )
      `,
      )
      .order('created_at', { ascending: false })
      .limit(50);

    // Exclude blocked users' moments (both directions)
    if (blockedIds.length > 0) {
      query = query.not('author_id', 'in', `(${blockedIds.join(',')})`);
    }

    // Apply filter logic
    if (filter === 'classmates') {
      // Get current user's target languages
      const { data: currentUser, error: userError } = await supabase
        .from('users')
        .select('target_languages, native_languages')
        .eq('id', currentUserId)
        .single();

      if (userError || !currentUser) {
        this.logger.error(
          `Failed to fetch current user: ${userError?.message}`,
        );
        return [];
      }

      // Show moments from users who share target languages or native language
      const targetLangs: string[] =
        (
          currentUser as {
            target_languages?: string[];
            native_languages?: string[];
          }
        ).target_languages || [];
      const nativeLang: string | undefined = (
        currentUser as {
          target_languages?: string[];
          native_languages?: string;
        }
      ).native_languages;

      // Build OR conditions for language matching
      const conditions: string[] = [];
      if (targetLangs.length > 0) {
        conditions.push(
          `author.native_languages.in.(${targetLangs.map((l) => `"${l}"`).join(',')})`,
        );
      }
      if (nativeLang) {
        conditions.push(`author.target_languages.cs.{${nativeLang}}`);
      }

      if (conditions.length > 0) {
        query = query.or(conditions.join(','));
      }
    } else if (filter === 'following') {
      // Get users the current user follows
      const { data: following, error: followError } = await supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', currentUserId);

      if (followError) {
        this.logger.error(`Failed to fetch following: ${followError.message}`);
        return [];
      }

      if (following && following.length > 0) {
        const followedIds: string[] = (
          following as { followed_id: string }[]
        ).map((f: { followed_id: string }) => f.followed_id);
        query = query.in('author_id', followedIds);
      } else {
        // No one followed, return empty
        return [];
      }
    }

    const { data: feedData, error: feedError } = await query;

    if (feedError || !feedData) {
      this.logger.error(`Failed to fetch feed: ${feedError?.message}`);
      return [];
    }

    return feedData as Moment[];
  }

  async getMomentById(
    momentId: string,
    currentUserId: string,
  ): Promise<Moment | null> {
    const supabase = this.supabaseService.getClient();

    // Check if author is blocked
    const blockedUserIds =
      await this.safetyService.getBlockedUserIds(currentUserId);

    const momentResponse = await supabase
      .from('moments')
      .select(
        `
        *,
        author:users!moments_author_id_fkey (
          id,
          display_name,
          avatar_url,
          native_languages,
          target_languages
        )
      `,
      )
      .eq('id', momentId)
      .single();

    if (momentResponse.error || !momentResponse.data) {
      return null;
    }

    const moment = momentResponse.data as Moment;

    // If author is blocked, return null
    if (blockedUserIds.includes(moment.author_id)) {
      return null;
    }

    return moment;
  }

  async createMoment(
    authorId: string,
    content: {
      content_text?: string;
      media_urls?: string[];
      voice_note_url?: string;
      detected_language?: string;
    },
  ): Promise<Moment> {
    const supabase = this.supabaseService.getClient();

    const insertResponse = await supabase
      .from('moments')
      .insert({
        author_id: authorId,
        content_text: content.content_text || null,
        media_urls: content.media_urls || [],
        voice_note_url: content.voice_note_url || null,
        detected_language: content.detected_language || null,
      })
      .select(
        `
        *,
        author:users!moments_author_id_fkey (
          id,
          display_name,
          avatar_url,
          native_languages,
          target_languages
        )
      `,
      )
      .single();

    if (insertResponse.error || !insertResponse.data) {
      throw new Error(
        `Failed to create moment: ${insertResponse.error?.message}`,
      );
    }

    return insertResponse.data as Moment;
  }

  async deleteMoment(momentId: string, userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Verify ownership
    const momentResponse = await supabase
      .from('moments')
      .select('author_id')
      .eq('id', momentId)
      .single();

    if (momentResponse.error || !momentResponse.data) {
      throw new Error('Moment not found');
    }

    const momentData = momentResponse.data as unknown as {
      author_id: string;
    } | null;

    if (!momentData || momentData.author_id !== userId) {
      throw new Error('Not authorized to delete this moment');
    }

    const deleteResponse = await supabase
      .from('moments')
      .delete()
      .eq('id', momentId);

    if (deleteResponse.error) {
      throw new Error(
        `Failed to delete moment: ${deleteResponse.error.message}`,
      );
    }
  }
}
