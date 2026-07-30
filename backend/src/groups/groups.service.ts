import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from '../centrifugo/centrifugo.service';
import { InterestsService } from '../interests/interests.service';
import { AddMemberDto } from './dto/add-member.dto';
import { RemoveMemberDto } from './dto/remove-member.dto';
import { UpdateGroupSettingsDto } from './dto/update-group-settings.dto';

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

  async addMember(groupId: string, memberId: string): Promise<void> {
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

  async removeMember(groupId: string, memberId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', memberId);
    if (error) {
      throw new NotFoundException('Failed to remove member');
    }
  }

  async createGroup(
    ownerId: string,
    name: string,
    communityId?: string,
    interestId?: string,
    maxMembers?: number,
  ): Promise<any> {
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
    const updates: Record<string, unknown> = {};
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

  async getGroupMembers(groupId: string): Promise<any[]> {
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
      .eq('group_id', groupId);

    if (error) {
      throw new NotFoundException('Failed to fetch group members');
    }
    return data || [];
  }

  async getSettings(groupId: string): Promise<Record<string, unknown>> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('groups')
      .select(
        'can_send_messages, can_edit_info, description, rules, interest_id, max_members',
      )
      .eq('id', groupId)
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

  async getAnnouncements(groupId: string): Promise<any[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('group_announcements')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new NotFoundException('Failed to fetch announcements');
    }
    return data || [];
  }

  async getGroupInfo(groupId: string): Promise<any> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('groups')
      .select(
        `id, name, owner_id, community_id, interest_id, max_members, created_at,
        interest:interests(name)`,
      )
      .eq('id', groupId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Group not found');
    }
    return data;
  }

  async getGroupsByInterest(interestId: string): Promise<any[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('groups')
      .select(
        `id, name, owner_id, max_members,
        interest:interests(name)`,
      )
      .eq('interest_id', interestId);

    if (error) {
      throw new NotFoundException('Failed to fetch groups');
    }
    return data || [];
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

  async getGroupsByCommunity(communityId: string): Promise<any[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('community_id', communityId);
    if (error) {
      throw new NotFoundException('Failed to fetch groups');
    }
    return data || [];
  }

  async getDiscoverableGroups(userId: string): Promise<any[]> {
    const supabase = this.supabaseService.getClient();
    const { data: groups, error } = await supabase
      .from('groups')
      .select('id, name, owner_id, max_members, interest_id, created_at');
    if (error) {
      throw new NotFoundException('Failed to fetch groups');
    }

    const enriched = await Promise.all(
      groups.map(async (group: any) => {
        const { count: memberCount } = await supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id);

        const { data: membership } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', group.id)
          .eq('user_id', userId)
          .maybeSingle();

        const isMember = !!membership;
        return {
          ...group,
          member_count: memberCount ?? 0,
          is_member: isMember,
        };
      }),
    );

    return enriched;
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
}
