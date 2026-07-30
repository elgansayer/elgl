import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { GroupsService } from '../groups/groups.service';
import { CreateCommunityDto } from './dto/create-community.dto';

@Injectable()
export class CommunitiesService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly groupsService: GroupsService,
  ) {}

  async create(ownerId: string, dto: CreateCommunityDto): Promise<any> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('communities')
      .insert({
        name: dto.name,
        description: dto.description ?? null,
        owner_id: ownerId,
      })
      .select()
      .single();
    if (error) {
      throw new NotFoundException('Failed to create community');
    }
    return data;
  }

  async findById(communityId: string): Promise<any> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .eq('id', communityId)
      .single();
    if (error || !data) {
      throw new NotFoundException('Community not found');
    }
    return data;
  }

  async listByOwner(ownerId: string): Promise<any[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .eq('owner_id', ownerId);
    if (error) {
      throw new NotFoundException('Failed to list communities');
    }
    return data || [];
  }

  async addGroup(communityId: string, groupId: string): Promise<void> {
    // Verify community exists
    await this.findById(communityId);
    // Link group via its community_id
    await this.groupsService.setCommunityId(groupId, communityId);
  }

  async removeGroup(groupId: string): Promise<void> {
    // Unlink group
    await this.groupsService.setCommunityId(groupId, null);
  }

  async getGroups(communityId: string): Promise<any[]> {
    await this.findById(communityId);
    return this.groupsService.getGroupsByCommunity(communityId);
  }
}
