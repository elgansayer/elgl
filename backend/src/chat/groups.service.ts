import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class GroupsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private async checkIsAdmin(groupId: string, userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from('chat_group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (!data || data.role !== 'admin') {
      throw new ForbiddenException('Only group admins can perform this action');
    }
  }

  async createGroup(creatorId: string, name: string) {
    const supabase = this.supabaseService.getClient();
    const { data: group, error: groupError } = await supabase
      .from('chat_groups')
      .insert({ name })
      .select()
      .single();
      
    if (groupError) throw groupError;

    await supabase
      .from('chat_group_members')
      .insert({ group_id: group.id, user_id: creatorId, role: 'admin' });

    return group;
  }

  async renameGroup(requesterId: string, groupId: string, newName: string) {
    await this.checkIsAdmin(groupId, requesterId);
    const supabase = this.supabaseService.getClient();
    
    const { data, error } = await supabase
      .from('chat_groups')
      .update({ name: newName })
      .eq('id', groupId)
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }

  async addMember(requesterId: string, groupId: string, targetUserId: string) {
    await this.checkIsAdmin(groupId, requesterId);
    const supabase = this.supabaseService.getClient();
    
    const { error } = await supabase
      .from('chat_group_members')
      .insert({ group_id: groupId, user_id: targetUserId, role: 'member' });
      
    if (error) throw error;
    return { success: true };
  }

  async removeMember(requesterId: string, groupId: string, targetUserId: string) {
    await this.checkIsAdmin(groupId, requesterId);
    const supabase = this.supabaseService.getClient();
    
    const { error } = await supabase
      .from('chat_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', targetUserId);
      
    if (error) throw error;
    return { success: true };
  }
}
