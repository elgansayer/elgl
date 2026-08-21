import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface DirectConversationResult {
  room_id: string;
}

type DirectConversationRpcError = {
  message?: string;
  details?: string;
};

type DirectConversationRpcResult = {
  data: unknown;
  error: DirectConversationRpcError | null;
};

@Injectable()
export class DirectConversationService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async openOrCreate(
    actorId: string,
    targetUserId: string,
  ): Promise<DirectConversationResult> {
    if (actorId === targetUserId) {
      throw new BadRequestException('You cannot message yourself.');
    }

    const { data, error } = (await this.supabaseService.getClient().rpc(
      'open_or_create_direct_conversation' as never,
      {
        p_actor_id: actorId,
        p_target_user_id: targetUserId,
      } as never,
    )) as unknown as DirectConversationRpcResult;

    if (error) {
      const detail = `${error.message ?? ''} ${error.details ?? ''}`;
      if (detail.includes('direct_conversation_self')) {
        throw new BadRequestException('You cannot message yourself.');
      }
      if (detail.includes('direct_conversation_blocked')) {
        throw new ForbiddenException('You cannot message this user.');
      }
      if (detail.includes('direct_conversation_message_restricted')) {
        throw new ForbiddenException(
          'This user is not accepting new conversations from your profile.',
        );
      }
      if (detail.includes('direct_conversation_target_unavailable')) {
        throw new NotFoundException('This user is not available.');
      }
      if (detail.includes('direct_conversation_actor_unavailable')) {
        throw new ForbiddenException(
          'Your account cannot start conversations.',
        );
      }
      throw new ServiceUnavailableException(
        'Unable to open this conversation. Please try again.',
      );
    }

    if (typeof data !== 'string' || data.length === 0) {
      throw new ServiceUnavailableException(
        'Unable to open this conversation. Please try again.',
      );
    }

    return { room_id: data };
  }
}
