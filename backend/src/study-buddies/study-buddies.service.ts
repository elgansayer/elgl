import { Injectable, Logger } from '@nestjs/common';
import { StudyBuddyRequestDto } from './dto/study-buddy.dto';
import { SupabaseService } from '../supabase/supabase.service';

interface BuddyRequest {
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
}
