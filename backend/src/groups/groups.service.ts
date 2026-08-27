import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  SupabaseService,
  type GroupsRow,
  type CommunityRow,
} from '../supabase/supabase.service';
import { CentrifugoService } from '../chat/centrifugo.service';
import { InterestsService } from '../interests/interests.service';
import { UpdateGroupSettingsDto } from './dto/update-group-settings.dto';

export interface GroupRecord {
  id: string;
  name: string;
  owner_id: string;
  community_id: string | null;
  interest_id: string | null;
  max_members: number;
  created_at: string;
}

export interface GroupInfo {
  id: string;
  name: string;
  owner_id: string;
  max_members: number;
  interest: { name: string } | Array<{ name: string }> | null;
  interest_id: string | null;
  community_id: string | null;
}

export interface GroupMemberRecord {
  user_id: string;
  user: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface GroupSettings {
  can_send_messages: boolean | null;
  can_edit_info: boolean | null;
  description: string | null;
  rules: string | null;
  interest_id: string | null;
  max_members: number;
}

export interface GroupAnnouncement {
  id: string;
  message: string;
  senderId: string;
  createdAt: string;
}

export interface GroupInfoRow {
  id: string;
  name: string;
  owner_id: string;
  max_members: number;
  interest_id: string | null;
  community_id: string | null;
  interest: Array<{ name: string }> | null;
}

export interface DiscoverableGroupRow {
  id: string;
  name: string;
  owner_id: string;
  community_id: string | null;
  interest_id: string | null;
  max_members: number;
  created_at: string;
}

export interface GroupResource {
  id: string;
  group_id: string;
  title: string;
  url: string;
  description?: string;
  created_at: string;
}

export interface CommunityRecord {
  id: string;
  name: string;
  description?: string | null | undefined;
  owner_id: string;
  created_at: string;
}

@Injectable()
export class GroupsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly centrifugoService: CentrifugoService,
    private readonly interestsService: InterestsService,
  ) {}

  async isAdmin(userId: string, groupId: string): Promise<boolean> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('groups')
      .select('owner_id')
      .eq('id', groupId)
      .single();

    if (error || !data) {
      return false;
    }
    return data.owner_id === userId;
  }

  private async ensureAdmin(userId: string, groupId: string): Promise<void> {
    const isAdmin = await this.isAdmin(userId, groupId);
    if (!isAdmin) {
      throw new ForbiddenException('Only group admin can perform this action');
    }
  }

  async addMember(
    groupId: string,
    memberId: string,
    requesterId: string,
  ): Promise<void> {
    await this.ensureAdmin(requesterId, groupId);

    const supabase = this.supabaseService.getClient();

    // fetch group to get max_members
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('max_members')
      .eq('id', groupId)
      .single();
    if (groupError || !group) {
      throw new NotFoundException('Group not found');
    }

    // verify target user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', memberId)
      .maybeSingle();
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // prevent duplicate membership
    const { data: existingMembership } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', memberId)
      .maybeSingle();
    if (existingMembership) {
      throw new ConflictException('User is already a member of this group');
    }

    // count current members
    const { count, error: countError } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId);
    if (countError) {
      throw new NotFoundException('Could not count members');
    }

    if (count !== null && count >= group.max_members) {
      throw new ForbiddenException('Group is already full');
    }

    const { error } = await supabase
      .from('group_members')
      .insert({ group_id: groupId, user_id: memberId });
    if (error) {
      throw new NotFoundException('Failed to add member');
    }
  }

  async removeMember(
    groupId: string,
    memberId: string,
    requesterId: string,
  ): Promise<void> {
    await this.ensureAdmin(requesterId, groupId);

    const supabase = this.supabaseService.getClient();

    // fetch group to check ownership
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('owner_id')
      .eq('id', groupId)
      .single();
    if (groupError || !group) {
      throw new NotFoundException('Group not found');
    }

    // prevent removing the owner from the group
    if (memberId === group.owner_id) {
      throw new ForbiddenException('Cannot remove the group owner');
    }

    // ensure member actually exists
    const { data: membership } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', memberId)
      .maybeSingle();
    if (!membership) {
      throw new NotFoundException('Member not found in group');
    }

    const { error } = await supabase
      .from('group_members')
      .delete()
      .match({ group_id: groupId, user_id: memberId });
    if (error) {
      throw new NotFoundException('Failed to remove member');
    }
  }

  async renameGroup(
    groupId: string,
    newName: string,
    requesterId: string,
  ): Promise<void> {
    await this.ensureAdmin(requesterId, groupId);

    // enforce basic name validation as a safety net
    const trimmedName = newName.trim();
    if (trimmedName.length === 0 || trimmedName.length > 200) {
      throw new BadRequestException(
        'Group name must be between 1 and 200 characters',
      );
    }

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('groups')
      .update({ name: trimmedName })
      .eq('id', groupId);
    if (error) {
      throw new NotFoundException('Failed to rename group');
    }
  }

  async createGroup(
    ownerId: string,
    name: string,
    communityId?: string,
    interestId?: string,
    maxMembers?: number,
  ): Promise<GroupRecord> {
    if (interestId) {
      const interest = await this.interestsService.findById(interestId);
      if (!interest) {
        throw new NotFoundException('Interest not found');
      }
    }

    // enforce group size limits
    if (maxMembers === undefined || maxMembers < 2) maxMembers = 2;
    if (maxMembers > 19) maxMembers = 19;

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('groups')
      .insert({
        name,
        owner_id: ownerId,
        community_id: communityId ?? null,
        interest_id: interestId ?? null,
        max_members: maxMembers,
      })
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Failed to create group');
    }

    // Add the owner as a member of the newly created group
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({ group_id: data.id, user_id: ownerId });

    if (memberError) {
      console.error('Failed to add owner as member:', memberError.message);
    }

    return data;
  }

  async updateSettings(
    groupId: string,
    dto: UpdateGroupSettingsDto,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const updates: Partial<GroupsRow> = {};
    if (dto.can_send_messages !== undefined) {
      updates.can_send_messages = dto.can_send_messages;
    }
    if (dto.can_edit_info !== undefined) {
      updates.can_edit_info = dto.can_edit_info;
    }
    if (dto.description !== undefined) {
      updates.description = dto.description;
    }
    if (dto.rules !== undefined) {
      updates.rules = dto.rules;
    }
    const { error } = await supabase
      .from('groups')
      .update(updates)
      .eq('id', groupId);
    if (error) {
      throw new NotFoundException('Failed to update group settings');
    }
  }

  async restrictSendMessages(
    groupId: string,
    canSendMessages: boolean,
  ): Promise<void> {
    await this.updateSettings(groupId, { can_send_messages: canSendMessages });
  }

  async restrictEditInfo(groupId: string, canEditInfo: boolean): Promise<void> {
    await this.updateSettings(groupId, { can_edit_info: canEditInfo });
  }

  async getGroupMembers(groupId: string): Promise<GroupMemberRecord[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('group_members')
      .select(
        `
        user_id,
        user:users (
          id,
          display_name,
          avatar_url
        )
      `,
      )
      .eq('group_id', groupId)
      .returns<GroupMemberRecord[]>();

    if (error) {
      throw new NotFoundException('Failed to fetch group members');
    }
    return data || [];
  }

  async getSettings(groupId: string): Promise<GroupSettings> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('groups')
      .select(
        'can_send_messages, can_edit_info, description, rules, interest_id, max_members',
      )
      .eq('id', groupId)
      .returns<GroupSettings>()
      .single();

    if (error || !data) {
      throw new NotFoundException('Group not found');
    }
    return data;
  }

  async sendAnnouncement(
    groupId: string,
    message: string,
    senderId: string,
  ): Promise<{ success: boolean }> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('group_announcements').insert({
      group_id: groupId,
      sender_id: senderId,
      message,
    });
    if (error) {
      throw new NotFoundException('Failed to send announcement');
    }
    // Broadcast via Centrifugo so active members receive it instantly
    const channel = `group_announcements:${groupId}`;
    await this.centrifugoService.publish(channel, {
      type: 'announcement',
      message,
      senderId,
    });
    return { success: true };
  }

  async getAnnouncements(groupId: string): Promise<GroupAnnouncement[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('group_announcements')
      .select('id, sender_id, message, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new NotFoundException('Failed to fetch announcements');
    }

    const rows = (data ?? []) as Array<{
      id: string;
      sender_id: string;
      message: string;
      created_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      message: row.message,
      senderId: row.sender_id,
      createdAt: row.created_at,
    }));
  }

  async getMyAdminGroups(userId: string): Promise<GroupRecord[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('owner_id', userId)
      .returns<GroupRecord[]>();
    if (error) {
      throw new NotFoundException('Failed to fetch groups');
    }
    return data || [];
  }

  async getGroupInfo(groupId: string): Promise<GroupInfo> {
    const supabase = this.supabaseService.getClient();
    const { data: rawData, error } = await supabase
      .from('groups')
      .select(
        `id, name, owner_id, community_id, interest_id, max_members, created_at,
        interest:interests(name)`,
      )
      .eq('id', groupId)
      .single();

    if (error || !rawData) {
      throw new NotFoundException('Group not found');
    }
    const data = rawData as unknown as GroupInfoRow;
    const interestValue = Array.isArray(data.interest)
      ? (data.interest[0] ?? null)
      : data.interest;
    return {
      id: data.id,
      name: data.name,
      owner_id: data.owner_id,
      max_members: data.max_members,
      interest_id: data.interest_id,
      community_id: data.community_id,
      interest: interestValue ?? null,
    };
  }

  async getGroupsByInterest(interestId: string): Promise<GroupInfo[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('groups')
      .select(
        `id, name, owner_id, community_id, interest_id, max_members, created_at,
        interest:interests(name)`,
      )
      .eq('interest_id', interestId)
      .returns<GroupInfoRow[]>();

    if (error) {
      throw new NotFoundException('Failed to fetch groups');
    }
    const rows = data ?? [];
    return rows.map((row) => {
      const interest = Array.isArray(row.interest)
        ? (row.interest[0] ?? null)
        : row.interest;
      return {
        id: row.id,
        name: row.name,
        owner_id: row.owner_id,
        max_members: row.max_members,
        interest_id: row.interest_id,
        community_id: row.community_id,
        interest,
      };
    });
  }

  async setCommunityId(
    groupId: string,
    communityId: string | null,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('groups')
      .update({ community_id: communityId })
      .eq('id', groupId);
    if (error) {
      throw new NotFoundException('Failed to assign group to community');
    }
  }

  async getGroupsByCommunity(communityId: string): Promise<GroupRecord[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('community_id', communityId)
      .returns<GroupRecord[]>();
    if (error) {
      throw new NotFoundException('Failed to fetch groups');
    }
    return data || [];
  }

  async getDiscoverableGroups(
    userId: string,
  ): Promise<
    Array<GroupRecord & { member_count: number; is_member: boolean }>
  > {
    const supabase = this.supabaseService.getClient();
    const { data: groups, error } = await supabase
      .from('groups')
      .select(
        'id, name, owner_id, community_id, interest_id, max_members, created_at',
      )
      .returns<DiscoverableGroupRow[]>();
    if (error) {
      throw new NotFoundException('Failed to fetch groups');
    }

    if (!groups || groups.length === 0) {
      return [];
    }

    const groupIds = groups.map((g) => g.id);

    // Batch request 1: Get user memberships
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id')
      .in('group_id', groupIds)
      .eq('user_id', userId);

    const userGroupIds = new Set((memberships || []).map((m) => m.group_id));

    // ⚡ Bolt: Performance optimization
    // Reduced queries from 2N to N+1 by batching the membership lookup.
    // N groups: 1 query for all memberships, N queries for member counts.
    const countPromises = groups.map((group) =>
      supabase
        .from('group_members')
        .select('group_id', { count: 'exact', head: true })
        .eq('group_id', group.id),
    );

    const countResults = await Promise.all(countPromises);

    return groups.map((group, index) => {
      const { count: memberCount } = countResults[index];
      return {
        ...group,
        member_count: memberCount ?? 0,
        is_member: userGroupIds.has(group.id),
      };
    });
  }

  async joinGroup(
    groupId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const supabase = this.supabaseService.getClient();

    // fetch group to get max_members
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('max_members')
      .eq('id', groupId)
      .single();
    if (groupError || !group) {
      throw new NotFoundException('Group not found');
    }

    // check if already a member
    const { data: existing } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();
    if (existing) {
      return { success: false };
    }

    // count current members
    const { count } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId);
    if (count !== null && count >= group.max_members) {
      throw new ForbiddenException('Group is full');
    }

    const { error: insertError } = await supabase
      .from('group_members')
      .insert({ group_id: groupId, user_id: userId });

    if (insertError) {
      throw new NotFoundException('Failed to join group');
    }

    return { success: true };
  }

  async getGroupResources(groupId: string): Promise<GroupResource[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('group_resources')
      .select('*')
      .eq('group_id', groupId)
      .returns<GroupResource[]>();

    if (error) {
      throw new NotFoundException('Failed to fetch group resources');
    }
    return data || [];
  }

  async deleteGroupResource(
    groupId: string,
    resourceId: string,
    requesterId: string,
  ): Promise<void> {
    const isAdmin = await this.isAdmin(requesterId, groupId);
    if (!isAdmin) {
      throw new ForbiddenException('Only group admin can delete resources');
    }
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('group_resources')
      .delete()
      .eq('id', resourceId)
      .eq('group_id', groupId);

    if (error) {
      throw new NotFoundException('Failed to delete resource');
    }
  }

  // --- Community management helpers ---
  async createCommunity(
    ownerId: string,
    name: string,
    description?: string,
  ): Promise<CommunityRecord> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('communities')
      .insert({
        name,
        description: description ?? null,
        owner_id: ownerId,
      })
      .select()
      .single();
    if (error || !data) {
      throw new NotFoundException('Failed to create community');
    }
    return data;
  }

  async getMyCommunities(userId: string): Promise<CommunityRecord[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .eq('owner_id', userId)
      .returns<CommunityRecord[]>();
    if (error) {
      throw new NotFoundException('Failed to fetch communities');
    }
    return data || [];
  }

  async getCommunity(communityId: string): Promise<CommunityRecord> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .eq('id', communityId)
      .returns<CommunityRecord>()
      .single();
    if (error || !data) {
      throw new NotFoundException('Community not found');
    }
    return data;
  }

  async updateCommunity(
    communityId: string,
    updates: { name?: string; description?: string },
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const patch: Partial<CommunityRow> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.description !== undefined) {
      patch.description = updates.description;
    }
    const { error } = await supabase
      .from('communities')
      .update(patch)
      .eq('id', communityId);
    if (error) {
      throw new NotFoundException('Failed to update community');
    }
  }

  async deleteCommunity(communityId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    // Detach all groups that belong to this community
    const { error: groupError } = await supabase
      .from('groups')
      .update({ community_id: null })
      .eq('community_id', communityId);
    if (groupError) {
      throw new NotFoundException('Failed to detach community groups');
    }
    const { error } = await supabase
      .from('communities')
      .delete()
      .eq('id', communityId);
    if (error) {
      throw new NotFoundException('Failed to delete community');
    }
  }

  async addGroupToCommunity(
    communityId: string,
    groupId: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: community } = await supabase
      .from('communities')
      .select('id')
      .eq('id', communityId)
      .maybeSingle();
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    const { data: group } = await supabase
      .from('groups')
      .select('id')
      .eq('id', groupId)
      .maybeSingle();
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    await this.setCommunityId(groupId, communityId);
  }

  async removeGroupFromCommunity(
    communityId: string,
    groupId: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: group } = await supabase
      .from('groups')
      .select('community_id')
      .eq('id', groupId)
      .maybeSingle();
    if (!group || group.community_id !== communityId) {
      throw new NotFoundException('Group not in this community');
    }
    await this.setCommunityId(groupId, null);
  }
}
