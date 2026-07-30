import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from '../centrifugo/centrifugo.service';
import { AddMemberDto } from './dto/add-member.dto';
import { RemoveMemberDto } from './dto/remove-member.dto';
import { UpdateGroupSettingsDto } from './dto/update-group-settings.dto';

@Injectable()
export class GroupsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly centrifugoService: CentrifugoService,
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
  ): Promise<any> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('groups')
      .insert({
        name,
        owner_id: ownerId,
        community_id: communityId ?? null,
      })
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Failed to create group');
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
      .select('can_send_messages, can_edit_info, description, rules')
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
}
