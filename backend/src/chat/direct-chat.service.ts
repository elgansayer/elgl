import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyService } from '../safety/safety.service';

const MAX_ROOM_ID_LENGTH = 128;

@Injectable()
export class DirectChatService {
  private readonly logger = new Logger(DirectChatService.name);
  private readonly inFlight = new Map<string, Promise<{ room_id: string }>>();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly safetyService: SafetyService,
  ) {}

  async openDirectChat(userId: string, partnerId: string): Promise<{ room_id: string }> {
    if (userId === partnerId) {
      throw new BadRequestException('You cannot start a direct chat with yourself');
    }

    const pairKey = [userId, partnerId].sort().join(':');
    const existing = this.inFlight.get(pairKey);
    if (existing) return existing;

    const request = this.openDirectChatOnce(userId, partnerId).finally(() => {
      if (this.inFlight.get(pairKey) === request) this.inFlight.delete(pairKey);
    });
    this.inFlight.set(pairKey, request);
    return request;
  }

  private async openDirectChatOnce(
    userId: string,
    partnerId: string,
  ): Promise<{ room_id: string }> {
    const supabase = this.supabaseService.getClient();

    const { data: partner, error: partnerError } = await supabase
      .from('users')
      .select('id')
      .eq('id', partnerId)
      .maybeSingle();

    if (partnerError) {
      this.logger.warn(
        `direct_chat_partner_lookup_failed code=${partnerError.code ?? 'unknown'}`,
      );
      throw new ServiceUnavailableException('Unable to open chat right now');
    }
    if (!partner) throw new NotFoundException('User not found');

    let blockedIds: string[];
    try {
      blockedIds = await this.safetyService.getBlockedAndBlockerIds(userId);
    } catch {
      this.logger.warn('direct_chat_safety_lookup_failed');
      throw new ServiceUnavailableException('Unable to open chat right now');
    }
    if (blockedIds.includes(partnerId)) {
      throw new ForbiddenException('Direct chat is unavailable for this user');
    }

    const { data, error } = await supabase.rpc('get_or_create_direct_chat', {
      p_user_id: userId,
      p_partner_id: partnerId,
    });

    if (error) {
      this.logger.warn(`direct_chat_open_failed code=${error.code ?? 'unknown'}`);
      throw new ServiceUnavailableException('Unable to open chat right now');
    }

    const roomId = typeof data === 'string' ? data.trim() : '';
    if (!roomId || roomId.length > MAX_ROOM_ID_LENGTH || /[/?#\\]/.test(roomId)) {
      this.logger.warn('direct_chat_open_invalid_response');
      throw new ServiceUnavailableException('Unable to open chat right now');
    }

    return { room_id: roomId };
  }
}
