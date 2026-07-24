import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyService } from '../safety/safety.service';
import { Moment } from './interfaces/moment.interface';

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
    const blockedIds = await this.safetyService.getBlockedIds(currentUserId);

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
      query = query.not('author_id', 'in', `(${blockedIds.join(',')})`);
    }

    // Apply filter logic
    if (filter === 'classmates') {
      // Get current user's target languages
      const { data: currentUser } = await supabase
        .from('users')
        .select('target_languages, native_language')
        .eq('id', currentUserId)
        .single();

      if (currentUser) {
        // Show moments from users who share target languages or native language
        const targetLangs = currentUser.target_languages || [];
        const nativeLang = currentUser.native_language;

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
      }
    } else if (filter === 'following') {
      // Get users the current user follows
      const { data: following } = await supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', currentUserId);

      if (following && following.length > 0) {
        const followedIds = following.map(
          (f: { followed_id: string }) => f.followed_id,
        );
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
    const blockedIds = await this.safetyService.getBlockedIds(currentUserId);

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
    const { data: moment } = await supabase
      .from('moments')
      .select('author_id')
      .eq('id', momentId)
      .single();

    if (!moment || moment.author_id !== userId) {
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
