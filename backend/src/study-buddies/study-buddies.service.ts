import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { StudyBuddyRequestDto } from './dto/study-buddy.dto';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { UserProfile } from '../users/interfaces/user-profile.interface';

export type BuddyRequestStatus = 'pending' | 'accepted' | 'declined';

export interface BuddyRequesterSummary {
  id: string;
  display_name?: string;
  avatar_url?: string;
}

export interface BuddyRequest {
  id: string;
  requesterId: string;
  partnerId: string;
  message: string | null;
  status: BuddyRequestStatus;
  createdAt: string;
  updatedAt: string;
  requester?: BuddyRequesterSummary;
}

interface BuddyRequestRow {
  id: string;
  requester_id: string;
  partner_id: string;
  message?: string | null;
  status?: BuddyRequestStatus | null;
  created_at?: string;
  updated_at?: string;
  requester?: BuddyRequesterSummary | BuddyRequesterSummary[] | null;
}

@Injectable()
export class StudyBuddiesService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly usersService: UsersService,
  ) {}

  private toBuddyRequest(row: Partial<BuddyRequestRow>): BuddyRequest {
    const requester = Array.isArray(row.requester)
      ? row.requester[0]
      : (row.requester ?? undefined);
    return {
      id: row.id ?? '',
      requesterId: row.requester_id ?? '',
      partnerId: row.partner_id ?? '',
      message: row.message ?? null,
      status: row.status ?? 'pending',
      createdAt: row.created_at ?? '',
      updatedAt: row.updated_at ?? '',
      requester,
    };
  }

  async requestBuddy(
    dto: StudyBuddyRequestDto,
    requesterId: string,
  ): Promise<BuddyRequest> {
    if (dto.partnerId === requesterId) {
      throw new BadRequestException(
        'Cannot send a study buddy request to yourself',
      );
    }

    const supabase = this.supabaseService.getClient();
    const {
      data,
      error,
    }: {
      data: BuddyRequestRow | null;
      error: { message?: string } | null;
    } = await supabase
      .from('study_buddy_requests')
      .upsert(
        {
          requester_id: requesterId,
          partner_id: dto.partnerId,
          message: dto.message ?? null,
          status: 'pending',
        },
        { onConflict: 'requester_id,partner_id' },
      )
      .select('*')
      .single();

    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) {
      throw new Error(
        `Failed to create study buddy request: ${error?.message}`,
      );
    }
    return this.toBuddyRequest(row);
  }

  async getIncomingRequests(userId: string): Promise<BuddyRequest[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('study_buddy_requests')
      .select(
        `
        id,
        requester_id,
        partner_id,
        message,
        status,
        created_at,
        updated_at,
        requester:requester_id (
          id,
          display_name,
          avatar_url
        )
      `,
      )
      .eq('partner_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch incoming requests: ${error.message}`);
    }
    return ((data ?? []) as BuddyRequestRow[]).map((row) =>
      this.toBuddyRequest(row),
    );
  }

  async respondToRequest(
    requestId: string,
    userId: string,
    status: 'accepted' | 'declined',
  ): Promise<BuddyRequest> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('study_buddy_requests')
      .update({
        status: status as BuddyRequestStatus,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', requestId)
      .eq('partner_id', userId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update study buddy request: ${error.message}`);
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new NotFoundException('Study buddy request not found');
    }
    return this.toBuddyRequest(row);
  }

  async getPotentialBuddies(userId: string): Promise<UserProfile[]> {
    const supabase = this.supabaseService.getClient();

    const { data: user } = await supabase
      .from('users')
      .select('target_languages, native_languages, id')
      .eq('id', userId)
      .single();

    if (!user) return [];

    const nativeLanguages = user.native_languages || [];
    const targetLanguages = user.target_languages || [];

    let query = supabase
      .from('users')
      .select(
        'id, display_name, avatar_url, native_languages, target_languages, bio_text, proficiency_level, is_vip',
      )
      .neq('id', userId)
      .eq('privacy_hide_from_search', false);

    if (targetLanguages.length > 0) {
      query = query.overlaps('native_languages', targetLanguages);
    }
    if (nativeLanguages.length > 0) {
      query = query.overlaps('target_languages', nativeLanguages);
    }

    const { data }: { data: UserProfile[] | null } = await query
      .limit(20)
      .returns<UserProfile[]>();
    return data ?? [];
  }

  async followUser(userId: string, targetUserId: string): Promise<void> {
    await this.usersService.followUser(userId, targetUserId);
  }

  async unfollowUser(userId: string, targetUserId: string): Promise<void> {
    await this.usersService.unfollowUser(userId, targetUserId);
  }

  getOrCreateChannel(userId: string, otherUserId: string): { channel: string } {
    const ids = [userId, otherUserId].sort();
    const channelName = `chat_${ids[0]}_${ids[1]}`;
    return { channel: channelName };
  }
}
