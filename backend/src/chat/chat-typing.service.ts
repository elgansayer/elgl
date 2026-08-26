import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from './centrifugo.service';
import { SendTypingDto } from './dto/send-typing.dto';

interface TypingProfile {
  display_name?: string | null;
  avatar_url?: string | null;
}

@Injectable()
export class ChatTypingService {
  private readonly maxDisplayNameLength = 80;
  private readonly maxAvatarUrlLength = 2048;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly centrifugoService: CentrifugoService,
  ) {}

  async publish(userId: string, dto: SendTypingDto): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const membership = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', dto.room_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (membership.error) {
      throw new ServiceUnavailableException('Typing presence is unavailable.');
    }
    if (!membership.data) {
      throw new ForbiddenException('You are not a member of this chat room.');
    }

    const profileResult = await supabase
      .from('users')
      .select('display_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    const profile = profileResult.error
      ? null
      : (profileResult.data as TypingProfile | null);
    const displayName = this.sanitizeDisplayName(profile?.display_name);
    const avatarUrl = this.sanitizeAvatarUrl(profile?.avatar_url);

    try {
      await this.centrifugoService.publish(`chat:${dto.room_id}:typing`, {
        userId,
        displayName,
        avatarUrl,
        typing: dto.is_typing,
        timestamp: Date.now(),
      });
    } catch {
      throw new ServiceUnavailableException('Typing presence is unavailable.');
    }
  }

  private sanitizeDisplayName(value: string | null | undefined): string {
    const displayName = value?.trim().slice(0, this.maxDisplayNameLength) ?? '';
    return displayName || 'Someone';
  }

  private sanitizeAvatarUrl(value: string | null | undefined): string {
    const candidate = value?.trim() ?? '';
    if (!candidate || candidate.length > this.maxAvatarUrlLength) return '';
    if (candidate.startsWith('/')) return candidate;

    try {
      const parsed = new URL(candidate);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:'
        ? candidate
        : '';
    } catch {
      return '';
    }
  }
}
