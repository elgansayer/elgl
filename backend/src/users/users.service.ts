import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserProfile, ProfileVisitor } from './interfaces/user-profile.interface';

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
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return response.data as UserProfile;
  }

  async getVisitors(userId: string): Promise<ProfileVisitor[]> {
    const supabase = this.supabaseService.getClient();

    type SupabaseResponse = { data: ProfileVisitor[] | null; error: any };

    const { data, error }: SupabaseResponse = (await supabase
      .from('profile_visits')
      .select(
        `
        id,
        visitor_id,
        viewed_id,
        created_at,
        visitor:visitor_id (
          id,
          display_name,
          avatar_url,
          native_language,
          target_languages
        )
      `,
      )
      .eq('viewed_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)) as SupabaseResponse;

    if (error) {
      throw new InternalServerErrorException('Failed to fetch visitors');
    }

    return data ?? [];
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
