import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserProfile } from './interfaces/user-profile.interface';

@Injectable()
export class UsersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (response.error || !response.data) {
      return this.getMockProfile(userId);
    }

    return response.data as UserProfile;
  }

  private getMockProfile(userId: string): UserProfile {
    return {
      id: userId,
      display_name: 'My Profile (Mock)',
      native_language: 'en',
      target_languages: ['es', 'ja'],
      bio_text: 'This is my mock profile. I love learning languages!',
      avatar_url: `https://i.pravatar.cc/150?u=${userId}`,
      audio_intro_url: undefined,
      cover_photo_url: undefined,
      is_vip: true,
      vip_tier: 'premium',
      coins_balance: 500,
      study_streak_days: 15,
      correction_ratio: 0.95,
      is_serious_learner: true,
      privacy_hide_age: false,
      privacy_hide_location: false,
      privacy_hide_from_search: false,
      created_at: new Date().toISOString(),
    } as any;
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    isVip: boolean,
  ): Promise<UserProfile> {
    if (dto.target_languages && dto.target_languages.length > 1 && !isVip) {
      throw new BadRequestException(
        'Free tier allows a maximum of 1 target language. Upgrade to VIP (8 UKP / $10 USD per month) to study up to 3 languages simultaneously.',
      );
    }

    if (dto.target_languages && dto.target_languages.length > 3) {
      throw new BadRequestException(
        'A maximum of 3 target languages can be studied simultaneously.',
      );
    }

    if (dto.mock_location && !isVip) {
      throw new BadRequestException(
        'Location spoofing requires a VIP subscription (8 UKP / $10 USD per month).',
      );
    }

    const updatePayload: Record<string, unknown> = {};

    if (dto.display_name !== undefined)
      updatePayload.display_name = dto.display_name;
    if (dto.native_language !== undefined)
      updatePayload.native_language = dto.native_language;
    if (dto.target_languages !== undefined)
      updatePayload.target_languages = dto.target_languages;
    if (dto.bio_text !== undefined) updatePayload.bio_text = dto.bio_text;
    if (dto.avatar_url !== undefined) updatePayload.avatar_url = dto.avatar_url;
    if (dto.audio_intro_url !== undefined)
      updatePayload.audio_intro_url = dto.audio_intro_url;
    if (dto.cover_photo_url !== undefined)
      updatePayload.cover_photo_url = dto.cover_photo_url;
    if (dto.privacy_hide_age !== undefined)
      updatePayload.privacy_hide_age = dto.privacy_hide_age;
    if (dto.privacy_hide_location !== undefined)
      updatePayload.privacy_hide_location = dto.privacy_hide_location;
    if (dto.privacy_hide_from_search !== undefined)
      updatePayload.privacy_hide_from_search = dto.privacy_hide_from_search;

    if (dto.location) {
      updatePayload.location = `POINT(${dto.location.longitude} ${dto.location.latitude})`;
    }

    if (dto.mock_location) {
      updatePayload.mock_location = `POINT(${dto.mock_location.longitude} ${dto.mock_location.latitude})`;
    }

    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', userId)
      .select()
      .single();

    if (response.error || !response.data) {
      const msg = response.error?.message ?? 'Unknown error';
      throw new BadRequestException(`Failed to update profile: ${msg}`);
    }

    return response.data as UserProfile;
  }
}
