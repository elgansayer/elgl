import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyService } from '../safety/safety.service';
import { SystemMessageService } from './services/system-message.service';
import {
  AddGroupChatMembersDto,
  CreateGroupChatDto,
  TransferGroupChatAdminDto,
  UpdateGroupChatDto,
} from './dto/group-chat.dto';

export interface GroupChatRecord {
  id: string;
  type: 'group';
  title: string;
  topic: string | null;
  avatar_url: string | null;
  admin_id: string;
  max_members: number;
  member_count: number;
  created_at: string;
}

export interface GroupChatMember {
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  user: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

type DbError = { message?: string; code?: string } | null;

@Injectable()
export class GroupChatService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly safetyService: SafetyService,
    private readonly systemMessageService: SystemMessageService,
  ) {}

  private throwDbError(error: DbError): never {
    const message = error?.message ?? 'group_operation_failed';
    if (
      message.includes('group_admin_required') ||
      message.includes('group_membership_required') ||
      message.includes('chat_room_membership_required')
    ) {
      throw new ForbiddenException('You do not have permission to modify this group');
    }
    if (
      message.includes('group_not_found') ||
      message.includes('group_member_not_found')
    ) {
      throw new NotFoundException('Group or member not found');
    }
    if (
      message.includes('group_capacity_exceeded') ||
      message.includes('group_size_must_be_between_2_and_19') ||
      message.includes('invalid_group_title') ||
      message.includes('transfer_admin_before') ||
      message.includes('new_admin_must_be_member')
    ) {
      throw new BadRequestException(message.replaceAll('_', ' '));
    }
    throw new BadRequestException('Unable to update group chat');
  }

  private async assertNoBlockedMembers(
    requesterId: string,
    memberIds: string[],
  ): Promise<void> {
    const blocked = await this.safetyService.getBlockedAndBlockerIds(requesterId);
    if (memberIds.some((memberId) => blocked.includes(memberId))) {
      throw new ForbiddenException('Blocked users cannot be added to a group chat');
    }
  }

  private async ensureMembership(userId: string, roomId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('chat_room_members')
      .select('room_id, chat_rooms!inner(type, is_deleted)')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .eq('chat_rooms.type', 'group')
      .eq('chat_rooms.is_deleted', false)
      .maybeSingle();

    if (error || !data) {
      throw new ForbiddenException('Group membership is required');
    }
  }

  private async ensureAdmin(userId: string, roomId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('id', roomId)
      .eq('type', 'group')
      .eq('admin_id', userId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (error || !data) {
      throw new ForbiddenException('Only the group admin can perform this action');
    }
  }

  async create(userId: string, dto: CreateGroupChatDto): Promise<GroupChatRecord> {
    const memberIds = [...new Set(dto.memberIds)].filter((id) => id !== userId);
    if (memberIds.length < 1 || memberIds.length > 18) {
      throw new BadRequestException('Group chats must contain between 2 and 19 people');
    }
    await this.assertNoBlockedMembers(userId, memberIds);

    const supabase = this.supabaseService.getClient();
    const { data: roomId, error } = await supabase.rpc('create_group_chat', {
      p_creator_id: userId,
      p_title: dto.name.trim(),
      p_member_ids: memberIds,
    });
    if (error || typeof roomId !== 'string') this.throwDbError(error);

    await this.systemMessageService.publishToRoom(roomId as string, 'groupCreated', {
      actorId: userId,
      memberCount: memberIds.length + 1,
    });
    return this.get(userId, roomId as string);
  }

  async get(userId: string, roomId: string): Promise<GroupChatRecord> {
    await this.ensureMembership(userId, roomId);
    const supabase = this.supabaseService.getClient();

    const [{ data: room, error }, { count, error: countError }] = await Promise.all([
      supabase
        .from('chat_rooms')
        .select('id, type, title, topic, avatar_url, admin_id, max_members, created_at')
        .eq('id', roomId)
        .eq('type', 'group')
        .eq('is_deleted', false)
        .single(),
      supabase
        .from('chat_room_members')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId),
    ]);

    if (error || countError || !room || !room.admin_id) {
      throw new NotFoundException('Group not found');
    }

    return {
      id: room.id as string,
      type: 'group',
      title: (room.title as string | null) ?? 'Group chat',
      topic: (room.topic as string | null) ?? null,
      avatar_url: (room.avatar_url as string | null) ?? null,
      admin_id: room.admin_id as string,
      max_members: Number(room.max_members ?? 19),
      member_count: count ?? 0,
      created_at: room.created_at as string,
    };
  }

  async members(userId: string, roomId: string): Promise<GroupChatMember[]> {
    await this.ensureMembership(userId, roomId);
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('chat_room_members')
      .select(
        'user_id, role, joined_at, user:users!chat_room_members_user_id_fkey(id, display_name, avatar_url)',
      )
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });

    if (error) throw new NotFoundException('Unable to load group members');
    return (data ?? []) as unknown as GroupChatMember[];
  }

  async update(
    userId: string,
    roomId: string,
    dto: UpdateGroupChatDto,
  ): Promise<GroupChatRecord> {
    await this.ensureAdmin(userId, roomId);
    const updates: Record<string, string | null> = {};
    if (dto.name !== undefined) {
      const title = dto.name.trim();
      if (!title) throw new BadRequestException('Group name cannot be empty');
      updates['title'] = title;
      updates['name'] = title;
    }
    if (dto.topic !== undefined) updates['topic'] = dto.topic.trim() || null;
    if (dto.avatarUrl !== undefined) updates['avatar_url'] = dto.avatarUrl.trim() || null;

    if (Object.keys(updates).length > 0) {
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase
        .from('chat_rooms')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', roomId)
        .eq('type', 'group')
        .eq('admin_id', userId)
        .eq('is_deleted', false)
        .select('id')
        .maybeSingle();
      if (error || !data) {
        throw new ForbiddenException('Only the current group admin can edit group info');
      }
      await this.systemMessageService.publishToRoom(roomId, 'groupInfoUpdated', {
        actorId: userId,
      });
    }
    return this.get(userId, roomId);
  }

  async addMembers(
    userId: string,
    roomId: string,
    dto: AddGroupChatMembersDto,
  ): Promise<GroupChatMember[]> {
    const memberIds = [...new Set(dto.memberIds)].filter((id) => id !== userId);
    await this.assertNoBlockedMembers(userId, memberIds);
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.rpc('add_group_chat_members', {
      p_requester_id: userId,
      p_room_id: roomId,
      p_member_ids: memberIds,
    });
    if (error) this.throwDbError(error);

    if (Number(data ?? 0) > 0) {
      await this.systemMessageService.publishToRoom(roomId, 'memberAdded', {
        actorId: userId,
        memberIds,
      });
    }
    return this.members(userId, roomId);
  }

  async removeMember(userId: string, roomId: string, memberId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.rpc('remove_group_chat_member', {
      p_requester_id: userId,
      p_room_id: roomId,
      p_member_id: memberId,
    });
    if (error) this.throwDbError(error);

    await this.systemMessageService.publishToRoom(roomId, 'memberRemoved', {
      actorId: userId,
      memberId,
    });
  }

  async transferAdmin(
    userId: string,
    roomId: string,
    dto: TransferGroupChatAdminDto,
  ): Promise<GroupChatRecord> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.rpc('transfer_group_chat_admin', {
      p_requester_id: userId,
      p_room_id: roomId,
      p_new_admin_id: dto.memberId,
    });
    if (error) this.throwDbError(error);

    await this.systemMessageService.publishToRoom(roomId, 'groupAdminTransferred', {
      previousAdminId: userId,
      adminId: dto.memberId,
    });
    return this.get(dto.memberId, roomId);
  }

  async leave(userId: string, roomId: string): Promise<{ deleted: boolean }> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.rpc('leave_group_chat', {
      p_user_id: userId,
      p_room_id: roomId,
    });
    if (error) this.throwDbError(error);

    const deleted = data === true;
    if (!deleted) {
      await this.systemMessageService.publishToRoom(roomId, 'memberLeft', {
        memberId: userId,
      });
    }
    return { deleted };
  }
}
