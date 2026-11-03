import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyService } from '../safety/safety.service';

// Define Moment interface locally to avoid import issues
export interface Moment {
  id: string;
  user_id: string | null | undefined;
  text_content?: string | null;
  media_urls?: string[];
  voice_note_url?: string | null;
  target_language?: string | null;
  is_pinned: boolean;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author?: {
    id: string;
    display_name: string | null | undefined;
    avatar_url?: string | null;
    native_languages?: string[];
    target_languages?: string[];
  } | null;
}

interface MomentRow {
  id: string;
  user_id: string;
  text_content: string | null;
  media_urls: string[];
  voice_note_url: string | null;
  target_language: string | null;
  created_at: string;
}

interface AuthorRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  native_languages?: string[];
  target_languages?: string[];
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
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .select('serious_learner_mode')
      .eq('id', currentUserId)
      .single();

    if (profileError) {
      this.logger.error(`Failed to fetch profile: ${profileError.message}`);
      return [];
    }

    const seriousLearnerMode = (
      profileData as { serious_learner_mode?: boolean } | null
    )?.serious_learner_mode;
    if (seriousLearnerMode === true) {
      return [];
    }

    // Get blocked AND blocker user IDs to exclude from feed
    const blockedIds: string[] =
      await this.safetyService.getBlockedAndBlockerIds(currentUserId);

    let query = supabase
      .from('moments')
      .select(
        'id, user_id, text_content, media_urls, voice_note_url, target_language, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(50);

    // Exclude blocked users' moments (both directions)
    if (blockedIds.length > 0) {
      query = query.not('user_id', 'in', blockedIds);
    }

    if (filter === 'following') {
      // Get users the current user follows
      const { data: followingRows, error: followError } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', currentUserId);

      if (followError) {
        this.logger.error(
          `Failed to fetch follow list: ${followError.message}`,
        );
        return [];
      }

      const followedIds = (followingRows ?? [])
        .map((row) => row.following_id)
        .filter((id): id is string => !!id);

      if (followedIds.length === 0) {
        return [];
      }

      query = query.in('user_id', followedIds);
    } else if (filter === 'classmates') {
      // Get current user's language preferences
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

      const userInfo = currentUser as {
        target_languages?: string[];
        native_languages?: string;
      };

      const targetLangs = userInfo.target_languages ?? [];
      const nativeLang = userInfo.native_languages;

      // Build OR conditions for language matching on the users table
      const conditions: string[] = [];
      if (targetLangs.length > 0) {
        const quoted = targetLangs.map((l) => `"${l}"`).join(',');
        conditions.push(`native_languages.in.(${quoted})`);
      }
      if (nativeLang) {
        conditions.push(`target_languages.cs.{${nativeLang}}`);
      }

      if (conditions.length === 0) {
        return [];
      }

      const { data: matchedAuthors, error: matchError } = await supabase
        .from('users')
        .select('id')
        .or(conditions.join(','));

      if (matchError) {
        this.logger.error(`Failed to fetch classmates: ${matchError.message}`);
        return [];
      }

      const matchedIds = (matchedAuthors ?? [])
        .map((row) => row.id)
        .filter((id): id is string => !!id);
      if (matchedIds.length === 0) {
        return [];
      }

      query = query.in('user_id', matchedIds);
    }

    const { data: momentRows, error: momentError } =
      await query.returns<MomentRow[]>();

    if (momentError || !momentRows) {
      this.logger.error(`Failed to fetch moments: ${momentError?.message}`);
      return [];
    }

    const authorIds = Array.from(
      new Set(momentRows.map((moment) => moment.user_id)),
    ).filter((id): id is string => !!id);

    const authorMap = new Map<string, Moment['author']>();

    if (authorIds.length > 0) {
      const { data: authorRows, error: authorError } = await supabase
        .from('users')
        .select(
          'id, display_name, avatar_url, native_languages, target_languages',
        )
        .in('id', authorIds)
        .returns<AuthorRow[]>();

      if (authorError) {
        this.logger.error(`Failed to fetch authors: ${authorError.message}`);
        return [];
      }

      for (const author of authorRows ?? []) {
        authorMap.set(author.id, {
          id: author.id,
          display_name: author.display_name,
          avatar_url: author.avatar_url ?? null,
          native_languages: author.native_languages ?? [],
          target_languages: author.target_languages ?? [],
        });
      }
    }

    return momentRows.map((momentRow) => {
      return {
        id: momentRow.id,
        user_id: momentRow.user_id,
        text_content: momentRow.text_content ?? null,
        media_urls: momentRow.media_urls ?? [],
        voice_note_url: momentRow.voice_note_url ?? null,
        target_language: momentRow.target_language ?? null,
        is_pinned: false,
        likes_count: 0,
        comments_count: 0,
        created_at: momentRow.created_at,
        author: authorMap.get(momentRow.user_id) ?? null,
      };
    });
  }

  async getMomentById(
    momentId: string,
    currentUserId: string,
  ): Promise<Moment | null> {
    const supabase = this.supabaseService.getClient();

    // Check if author is blocked
    const blockedUserIds =
      await this.safetyService.getBlockedUserIds(currentUserId);

    const { data: momentRow, error: momentError } = await supabase
      .from('moments')
      .select(
        'id, user_id, text_content, media_urls, voice_note_url, target_language, created_at',
      )
      .eq('id', momentId)
      .single();

    if (momentError || !momentRow) {
      return null;
    }

    const typed = momentRow;

    if (blockedUserIds.includes(typed.user_id ?? '')) {
      return null;
    }

    const { data: authorRow, error: authorError } = await supabase
      .from('users')
      .select(
        'id, display_name, avatar_url, native_languages, target_languages',
      )
      .eq('id', typed.user_id ?? '')
      .single();

    let author: Moment['author'] = null;
    if (!authorError && authorRow) {
      const a = authorRow;
      author = {
        id: a.id,
        display_name: a.display_name,
        avatar_url: a.avatar_url ?? null,
        native_languages: a.native_languages ?? [],
        target_languages: a.target_languages ?? [],
      };
    }

    return {
      id: typed.id,
      user_id: typed.user_id,
      text_content: typed.text_content ?? null,
      media_urls: typed.media_urls ?? [],
      voice_note_url: typed.voice_note_url ?? null,
      target_language: typed.target_language ?? null,
      is_pinned: false,
      likes_count: 0,
      comments_count: 0,
      created_at: typed.created_at,
      author,
    };
  }

  async createMoment(
    authorId: string,
    content: {
      text_content?: string;
      media_urls?: string[];
      voice_note_url?: string;
      target_language?: string;
    },
  ): Promise<Moment> {
    const supabase = this.supabaseService.getClient();

    const { data: inserted, error: insertError } = await supabase
      .from('moments')
      .insert({
        user_id: authorId,
        text_content: content.text_content || null,
        media_urls: content.media_urls || [],
        voice_note_url: content.voice_note_url || null,
        target_language: content.target_language || null,
      })
      .select(
        'id, user_id, text_content, media_urls, voice_note_url, target_language, created_at',
      )
      .single();

    if (insertError || !inserted) {
      throw new Error(`Failed to create moment: ${insertError?.message}`);
    }

    const typed = inserted;

    const { data: authorRow, error: authorError } = await supabase
      .from('users')
      .select(
        'id, display_name, avatar_url, native_languages, target_languages',
      )
      .eq('id', typed.user_id ?? '')
      .single();

    let author: Moment['author'] = null;
    if (!authorError && authorRow) {
      const a = authorRow;
      author = {
        id: a.id,
        display_name: a.display_name,
        avatar_url: a.avatar_url ?? null,
        native_languages: a.native_languages ?? [],
        target_languages: a.target_languages ?? [],
      };
    }

    return {
      id: typed.id,
      user_id: typed.user_id,
      text_content: typed.text_content ?? null,
      media_urls: typed.media_urls ?? [],
      voice_note_url: typed.voice_note_url ?? null,
      target_language: typed.target_language ?? null,
      is_pinned: false,
      likes_count: 0,
      comments_count: 0,
      created_at: typed.created_at,
      author,
    };
  }

  async deleteMoment(momentId: string, userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Verify ownership
    const momentResponse = await supabase
      .from('moments')
      .select('user_id')
      .eq('id', momentId)
      .single();

    if (momentResponse.error || !momentResponse.data) {
      throw new Error('Moment not found');
    }

    const momentData = momentResponse.data as unknown as {
      user_id: string | null | undefined;
    } | null;

    if (!momentData || momentData.user_id !== userId) {
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
