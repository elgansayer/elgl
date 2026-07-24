import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyService } from '../safety/safety.service';
import { PostgrestError } from '@supabase/supabase-js';

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
    native_language?: string;
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

    // Get blocked user IDs to exclude from feed
    const blockedIds: string[] =
      await this.safetyService.getBlockedIds(currentUserId);

    let query = supabase
      .from('moments')
      .select(
        `
        *,
        author:users!moments_author_id_fkey (
          id,
          display_name,
          avatar_url,
          native_language,
          target_languages
        )
      `,
      )
      .order('created_at', { ascending: false })
      .limit(50);

    // Exclude blocked users' moments
    if (blockedIds.length > 0) {
      // Use filter method for 'not.in' operator
      query = query.filter('author_id', 'not.in', `(${blockedIds.join(',')})`);
    }

    // Apply filter logic
    if (filter === 'classmates') {
      // Get current user's target languages
      const { data: currentUser, error: userError } = await supabase
        .from('users')
        .select('target_languages, native_language')
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
            native_language?: string;
          }
        ).target_languages || [];
      const nativeLang: string | undefined = (
        currentUser as { target_languages?: string[]; native_language?: string }
      ).native_language;

      // Build OR conditions for language matching
      const conditions: string[] = [];
      if (targetLangs.length > 0) {
        conditions.push(
          `author.native_language.in.(${targetLangs.map((l: string) => `"${l}"`).join(',')})`,
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

    const response = await query;

    if (response.error || !response.data) {
      this.logger.error(`Failed to fetch feed: ${response.error?.message}`);
      return [];
    }

    return response.data as Moment[];
  }

  async getMomentById(
    momentId: string,
    currentUserId: string,
  ): Promise<Moment | null> {
    const supabase = this.supabaseService.getClient();

    // Check if author is blocked
    const blockedIds: string[] =
      await this.safetyService.getBlockedIds(currentUserId);

    const { data, error } = await supabase
      .from('moments')
      .select(
        `
        *,
        author:users!moments_author_id_fkey (
          id,
          display_name,
          avatar_url,
          native_language,
          target_languages
        )
      `,
      )
      .eq('id', momentId)
      .single();

    if (error || !data) {
      return null;
    }

    const moment = data as Moment;

    // If author is blocked, return null
    if (blockedIds.includes(moment.author_id)) {
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

    const { data, error } = await supabase
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
          native_language,
          target_languages
        )
      `,
      )
      .single();

    if (error || !data) {
      throw new Error(`Failed to create moment: ${error?.message}`);
    }

    return data as Moment;
  }

  async deleteMoment(momentId: string, userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Verify ownership
    const { data: moment, error: fetchError } = await supabase
      .from('moments')
      .select('author_id')
      .eq('id', momentId)
      .single();

    if (fetchError || !moment) {
      throw new Error('Moment not found');
    }

    const momentData = moment;

    if (momentData.author_id !== userId) {
      throw new Error('Not authorized to delete this moment');
    }

    const { error } = await supabase
      .from('moments')
      .delete()
      .eq('id', momentId);

    if (error) {
      throw new Error(`Failed to delete moment: ${error.message}`);
    }
  }
}
