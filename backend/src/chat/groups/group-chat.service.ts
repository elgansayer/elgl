import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { SystemMessageService } from '../services/system-message.service';
import {
  AddGroupMembersDto,
  CreateGroupChatDto,
  LeaveGroupChatDto,
  TransferGroupAdminDto,
  UpdateGroupChatDto,
} from './group-chat.dto';

export const MAX_GROUP_MEMBERS = 19;

export type GroupMember = {
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  user?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type GroupRoom = {
  id: string;
  type: string;
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  created_by: string | null;
  is_archived: boolean | null;
};

@Injectable()
export class GroupChatService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly systemMessageService: SystemMessageService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  private normaliseIds(ids: string[], exclude?: string): string[] {
    return [...new Set(ids)].filter((id) => id !== exclude);
  }

  private async getRoom(roomId: string): Promise<GroupRoom> {
    const { data, error } = await this.supabase
      .from('chat_rooms')
      .select('id,type,name,description,avatar_url,created_by,is_archived')
      .eq('id', roomId)
      .maybeSingle();

    if (error) throw new Error(`Failed to load group: ${error.message}`);
    if (!data || data.type !== 'group') throw new NotFoundException('Group chat not found');
    if (data.is_archived) throw new NotFoundException('Group chat is archived');
    return data as GroupRoom;
  }

  private async getMembership(roomId: string, userId: string) {
    const { data, error } = await this.supabase
      .from('chat_room_members')
      .select('room_id,user_id,role,joined_at')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new Error(`Failed to check group membership: ${error.message}`);
    return data as
      | { room_id: string; user_id: string; role: 'admin' | 'member'; joined_at: string }
      | null;
  }

  private async requireMember(roomId: string, userId: string) {
    await this.getRoom(roomId);
    const membership = await this.getMembership(roomId, userId);
    if (!membership) throw new ForbiddenException('You are not a member of this group');
    return membership;
  }

  private async requireAdmin(roomId: string, userId: string) {
    const membership = await this.requireMember(roomId, userId);
    if (membership.role !== 'admin') {
      throw new ForbiddenException('Only a group admin can perform this action');
    }
    return membership;
  }

  private async validateInvitees(inviterId: string, memberIds: string[]) {
    if (memberIds.length === 0) return;

    const { data: users, error: usersError } = await this.supabase
      .from('users')
      .select('id')
      .in('id', memberIds);
    if (usersError) throw new Error(`Failed to validate invitees: ${usersError.message}`);

    const existing = new Set((users ?? []).map((user: { id: string }) => user.id));
    const missing = memberIds.filter((id) => !existing.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`Unknown group member: ${missing[0]}`);
    }

    const { data: blocks, error: blockError } = await this.supabase
      .from('blocks')
      .select('blocker_id,blocked_id')
      .or(
        `and(blocker_id.eq.${inviterId},blocked_id.in.(${memberIds.join(',')})),and(blocked_id.eq.${inviterId},blocker_id.in.(${memberIds.join(',')}))`,
      );
    if (blockError) throw new Error(`Failed to validate block relationships: ${blockError.message}`);
    if ((blocks ?? []).length > 0) {
      throw new ForbiddenException('A blocked user cannot be added to this group');
    }
  }

  async createGroup(creatorId: string, dto: CreateGroupChatDto) {
    const memberIds = this.normaliseIds(dto.memberIds, creatorId);
    if (memberIds.length < 1 || memberIds.length > MAX_GROUP_MEMBERS - 1) {
      throw new BadRequestException('A group must contain 2 to 19 people including the creator');
    }
    await this.validateInvitees(creatorId, memberIds);

    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Group name is required');

    const { data: room, error: roomError } = await this.supabase
      .from('chat_rooms')
      .insert({
        type: 'group',
        name,
        description: dto.description?.trim() || null,
        created_by: creatorId,
        is_archived: false,
      })
      .select('id,type,name,description,avatar_url,created_by,is_archived,created_at')
      .single();

    if (roomError || !room) {
      throw new Error(`Failed to create group: ${roomError?.message ?? 'no room returned'}`);
    }

    const memberships = [
      { room_id: room.id, user_id: creatorId, role: 'admin' },
      ...memberIds.map((userId) => ({ room_id: room.id, user_id: userId, role: 'member' })),
    ];
    const { error: membershipError } = await this.supabase
      .from('chat_room_members')
      .insert(memberships);

    if (membershipError) {
      await this.supabase.from('chat_rooms').delete().eq('id', room.id);
      throw new Error(`Failed to add group members: ${membershipError.message}`);
    }

    await this.systemMessageService.publishToRoom(room.id, 'group_created', {
      actor_id: creatorId,
      member_ids: memberIds,
      name,
    });

    return { ...room, member_count: memberships.length, admin_id: creatorId };
  }

  async getGroup(roomId: string, userId: string) {
    const membership = await this.requireMember(roomId, userId);
    const room = await this.getRoom(roomId);
    const { count } = await this.supabase
      .from('chat_room_members')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId);
    return { ...room, member_count: count ?? 0, current_user_role: membership.role };
  }

  async getMembers(roomId: string, userId: string, limit = 50, offset = 0) {
    await this.requireMember(roomId, userId);
    const safeLimit = Math.min(Math.max(limit, 1), MAX_GROUP_MEMBERS);
    const safeOffset = Math.max(offset, 0);
    const { data, error, count } = await this.supabase
      .from('chat_room_members')
      .select(
        'user_id,role,joined_at,user:users!chat_room_members_user_id_fkey(id,display_name,avatar_url)',
        { count: 'exact' },
      )
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true })
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (error) throw new Error(`Failed to load group members: ${error.message}`);
    return { members: (data ?? []) as GroupMember[], total: count ?? 0 };
  }

  async updateGroup(roomId: string, actorId: string, dto: UpdateGroupChatDto) {
    await this.requireAdmin(roomId, actorId);
    const update: Record<string, string | null> = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Group name is required');
      update.name = name;
    }
    if (dto.description !== undefined) update.description = dto.description.trim() || null;
    if (dto.avatarUrl !== undefined) update.avatar_url = dto.avatarUrl.trim() || null;
    if (Object.keys(update).length === 0) return this.getGroup(roomId, actorId);

    const { data, error } = await this.supabase
      .from('chat_rooms')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('id', roomId)
      .select('id,type,name,description,avatar_url,created_by,is_archived,created_at')
      .single();
    if (error || !data) throw new Error(`Failed to update group: ${error?.message ?? 'no group returned'}`);

    await this.systemMessageService.publishToRoom(roomId, 'group_updated', {
      actor_id: actorId,
      fields: Object.keys(update),
    });
    return data;
  }

  async addMembers(roomId: string, actorId: string, dto: AddGroupMembersDto) {
    await this.requireAdmin(roomId, actorId);
    const requested = this.normaliseIds(dto.memberIds, actorId);
    if (requested.length === 0) return this.getMembers(roomId, actorId);

    const { data: existing, error: existingError } = await this.supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId);
    if (existingError) throw new Error(`Failed to load group members: ${existingError.message}`);

    const existingIds = new Set((existing ?? []).map((row: { user_id: string }) => row.user_id));
    const memberIds = requested.filter((id) => !existingIds.has(id));
    if (existingIds.size + memberIds.length > MAX_GROUP_MEMBERS) {
      throw new ConflictException(`Groups are limited to ${MAX_GROUP_MEMBERS} members`);
    }
    await this.validateInvitees(actorId, memberIds);

    if (memberIds.length > 0) {
      const { error } = await this.supabase.from('chat_room_members').insert(
        memberIds.map((userId) => ({ room_id: roomId, user_id: userId, role: 'member' })),
      );
      if (error) throw new Error(`Failed to add group members: ${error.message}`);
      await this.systemMessageService.publishToRoom(roomId, 'group_members_added', {
        actor_id: actorId,
        member_ids: memberIds,
      });
    }
    return this.getMembers(roomId, actorId);
  }

  async removeMember(roomId: string, actorId: string, memberId: string) {
    await this.requireAdmin(roomId, actorId);
    if (memberId === actorId) {
      throw new BadRequestException('Transfer admin ownership before leaving the group');
    }
    const membership = await this.getMembership(roomId, memberId);
    if (!membership) throw new NotFoundException('Group member not found');
    if (membership.role === 'admin') {
      throw new BadRequestException('Transfer or demote the admin before removing them');
    }

    const { error } = await this.supabase
      .from('chat_room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', memberId);
    if (error) throw new Error(`Failed to remove group member: ${error.message}`);

    await this.systemMessageService.publishToRoom(roomId, 'group_member_removed', {
      actor_id: actorId,
      member_id: memberId,
    });
    return { success: true };
  }

  async transferAdmin(roomId: string, actorId: string, dto: TransferGroupAdminDto) {
    await this.requireAdmin(roomId, actorId);
    if (dto.newAdminId === actorId) return { success: true, admin_id: actorId };
    const target = await this.getMembership(roomId, dto.newAdminId);
    if (!target) throw new BadRequestException('New admin must already be a group member');

    const { error: promoteError } = await this.supabase
      .from('chat_room_members')
      .update({ role: 'admin' })
      .eq('room_id', roomId)
      .eq('user_id', dto.newAdminId);
    if (promoteError) throw new Error(`Failed to promote new admin: ${promoteError.message}`);

    const { error: demoteError } = await this.supabase
      .from('chat_room_members')
      .update({ role: 'member' })
      .eq('room_id', roomId)
      .eq('user_id', actorId);
    if (demoteError) {
      await this.supabase
        .from('chat_room_members')
        .update({ role: 'member' })
        .eq('room_id', roomId)
        .eq('user_id', dto.newAdminId);
      throw new Error(`Failed to transfer admin ownership: ${demoteError.message}`);
    }

    await this.systemMessageService.publishToRoom(roomId, 'group_admin_transferred', {
      actor_id: actorId,
      admin_id: dto.newAdminId,
    });
    return { success: true, admin_id: dto.newAdminId };
  }

  async leaveGroup(roomId: string, userId: string, dto: LeaveGroupChatDto) {
    const membership = await this.requireMember(roomId, userId);
    const { count } = await this.supabase
      .from('chat_room_members')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId);

    if ((count ?? 0) <= 1) {
      const { error } = await this.supabase
        .from('chat_rooms')
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq('id', roomId);
      if (error) throw new Error(`Failed to archive empty group: ${error.message}`);
      await this.supabase.from('chat_room_members').delete().eq('room_id', roomId).eq('user_id', userId);
      return { success: true, archived: true };
    }

    if (membership.role === 'admin') {
      if (!dto.newAdminId) {
        throw new BadRequestException('Choose a new admin before leaving the group');
      }
      await this.transferAdmin(roomId, userId, { newAdminId: dto.newAdminId });
    }

    const { error } = await this.supabase
      .from('chat_room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);
    if (error) throw new Error(`Failed to leave group: ${error.message}`);

    await this.systemMessageService.publishToRoom(roomId, 'group_member_left', { member_id: userId });
    return { success: true, archived: false };
  }
}
