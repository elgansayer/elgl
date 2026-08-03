import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { StudyBuddyRequestDto } from './dto/study-buddy.dto';
import { SupabaseService } from '../supabase/supabase.service';
import { UserProfile } from '../users/interfaces/user-profile.interface';

export interface BuddyRequest {
  id: string;
  requesterId: string;
  partnerId: string;
  message?: string;
  status: string;
  createdAt: string;
}

@Injectable()
export class StudyBuddiesService {
  private readonly logger = new Logger(StudyBuddiesService.name);
  private requests: BuddyRequest[] = [];

  constructor(private readonly supabaseService: SupabaseService) {}

  requestBuddy(dto: StudyBuddyRequestDto, requesterId: string) {
    const request: BuddyRequest = {
      id: Date.now().toString(),
      requesterId,
      partnerId: dto.partnerId,
      message: dto.message,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.requests.push(request);
    return request;
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
      data: BuddyRequestRow[] | null;
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

    if (error || !data) {
      throw new Error(
        `Failed to create study buddy request: ${error?.message}`,
      );
    }
    return this.toBuddyRequest(data);
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
    if (!data) {
      throw new NotFoundException('Study buddy request not found');
    }
    return this.toBuddyRequest(data);
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
    if (userId === targetUserId) {
      throw new BadRequestException('Cannot follow yourself');
    }
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('follows')
      .insert([
        {
          follower_id: userId,
          following_id: targetUserId,
        },
      ])
      .single();
    if (error) {
      if (error.code === '23505') {
        // duplicate => already following, treat as success
        return;
      }
      throw new InternalServerErrorException('Failed to follow user');
    }
  }

  async unfollowUser(userId: string, targetUserId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', userId)
      .eq('following_id', targetUserId);
    if (error) {
      throw new InternalServerErrorException('Failed to unfollow user');
    }
  }

  getOrCreateChannel(userId: string, otherUserId: string): { channel: string } {
    const ids = [userId, otherUserId].sort();
    const channelName = `chat_${ids[0]}_${ids[1]}`;
    return { channel: channelName };
  }
}
