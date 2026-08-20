import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { SystemMessageService } from '../services/system-message.service';
import { CreateGroupChatDto } from './group-chat.dto';
import { MAX_GROUP_MEMBERS } from './group-chat.service';

type CreatedGroup = {
  id: string;
  type: string;
  name: string | null;
  description: string | null;
  topic: string | null;
  interest_id: string | null;
  avatar_url: string | null;
  created_by: string | null;
  is_archived: boolean | null;
  created_at?: string | null;
};

type PostgrestLikeError = {
  code?: string;
  message?: string;
};

@Injectable()
export class GroupChatCreateService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly systemMessageService: SystemMessageService,
  ) {}

  async create(creatorId: string, dto: CreateGroupChatDto) {
    const memberIds = [...new Set(dto.memberIds)].filter(
      (memberId) => memberId !== creatorId,
    );
    if (
      memberIds.length < 1 ||
      memberIds.length > MAX_GROUP_MEMBERS - 1
    ) {
      throw new BadRequestException(
        'A group must contain 2 to 19 people including the creator',
      );
    }

    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Group name is required');

    const { data, error } = await this.supabaseService.getClient().rpc(
      'create_group_chat_atomic',
      {
        p_creator_id: creatorId,
        p_name: name,
        p_description: dto.description?.trim() || null,
        p_topic: dto.topic?.trim() || null,
        p_interest_id: dto.interestId ?? null,
        p_member_ids: memberIds,
      },
    );

    if (error) this.throwCreateError(error as PostgrestLikeError);

    const candidate = Array.isArray(data) ? data[0] : data;
    if (!candidate || typeof candidate !== 'object' || !('id' in candidate)) {
      throw new Error('Group creation succeeded without returning a room');
    }
    const room = candidate as CreatedGroup;

    await this.systemMessageService.publishToRoom(room.id, 'group_created', {
      actor_id: creatorId,
      member_ids: memberIds,
      name,
      topic: dto.topic?.trim() || null,
      interest_id: dto.interestId ?? null,
    });

    return {
      ...room,
      member_count: memberIds.length + 1,
      admin_id: creatorId,
    };
  }

  private throwCreateError(error: PostgrestLikeError): never {
    switch (error.code) {
      case '42501':
        throw new ForbiddenException(
          error.message ?? 'A blocked user cannot be added to this group',
        );
      case '23514':
      case '23503':
      case '23502':
        throw new BadRequestException(
          error.message ?? 'Invalid group members or metadata',
        );
      case '23505':
        throw new ConflictException(error.message ?? 'Duplicate group membership');
      default:
        throw new Error(`Failed to create group: ${error.message ?? 'unknown database error'}`);
    }
  }
}
