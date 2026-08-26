import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SafetyService } from '../safety/safety.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { MomentLikeUser } from './moments.service';

interface MomentLikeQueryResult {
  user_id: string;
  created_at: string;
  users: MomentLikeUser | null;
}

interface MomentOwnerRow {
  user_id: string;
}

export interface MomentLikesPageOptions {
  offset?: number;
  limit?: number;
}

@Injectable()
export class MomentLikesService {
  static readonly DEFAULT_LIMIT = 50;
  static readonly MAX_LIMIT = 50;
  static readonly MAX_OFFSET = 10_000;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly safetyService: SafetyService,
  ) {}

  async listMomentLikes(
    momentId: string,
    viewerId: string,
    options: MomentLikesPageOptions = {},
  ): Promise<MomentLikeUser[]> {
    const offset = options.offset ?? 0;
    const limit = options.limit ?? MomentLikesService.DEFAULT_LIMIT;

    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset > MomentLikesService.MAX_OFFSET
    ) {
      throw new BadRequestException('Invalid likes offset.');
    }
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > MomentLikesService.MAX_LIMIT
    ) {
      throw new BadRequestException(
        `Likes limit must be between 1 and ${MomentLikesService.MAX_LIMIT}.`,
      );
    }

    const supabase = this.supabaseService.getClient();
    const { data: momentData, error: momentError } = (await supabase
      .from('moments')
      .select('user_id')
      .eq('id', momentId)
      .single()) as unknown as {
      data: MomentOwnerRow | null;
      error: { message?: string } | null;
    };

    if (momentError || !momentData) {
      throw new NotFoundException('Moment not found.');
    }

    const blockedIds =
      await this.safetyService.getBlockedAndBlockerIds(viewerId);
    if (blockedIds.includes(momentData.user_id)) {
      throw new ForbiddenException('This Moment is not available.');
    }

    const likesQuery = supabase
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
      .eq('moment_id', momentId);
    const visibleLikesQuery =
      blockedIds.length > 0
        ? likesQuery.not('user_id', 'in', `(${blockedIds.join(',')})`)
        : likesQuery;

    const { data, error } = await visibleLikesQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
      .returns<MomentLikeQueryResult[]>();

    if (error) {
      // Keep provider/database details out of the HTTP error surface.
      throw new Error('Failed to fetch Moment likes.');
    }

    return (data ?? [])
      .map((row) => row.users)
      .filter((user): user is MomentLikeUser => Boolean(user))
      .filter((user) => !blockedIds.includes(user.id));
  }
}
