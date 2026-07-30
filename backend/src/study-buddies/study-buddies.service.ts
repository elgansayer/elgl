import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { StudyBuddyRequestDto } from './dto/study-buddy.dto';
import { SupabaseService } from '../supabase/supabase.service';

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

  async requestBuddy(dto: StudyBuddyRequestDto, requesterId: string) {
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

  async getPotentialBuddies(userId: string) {
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

    const { data } = await query.limit(20);
    return (data ?? []) as any[];
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

  async getOrCreateChannel(
    userId: string,
    otherUserId: string,
  ): Promise<{ channel: string }> {
    const ids = [userId, otherUserId].sort();
    const channelName = `chat_${ids[0]}_${ids[1]}`;
    return { channel: channelName };
  }
}
