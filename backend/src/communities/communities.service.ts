import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { GroupsService, GroupRecord } from '../groups/groups.service';
import { CreateCommunityDto } from '../groups/dto/create-community.dto';
import { UpdateCommunityDto } from '../groups/dto/update-community.dto';

export interface CommunityRecord {
  id: string;
  name: string;
  description?: string | null;
  owner_id: string;
  created_at: string;
}

@Injectable()
export class CommunitiesService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly groupsService: GroupsService,
  ) {}

  async create(
    ownerId: string,
    dto: CreateCommunityDto,
  ): Promise<CommunityRecord> {
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

  async findById(communityId: string): Promise<CommunityRecord> {
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

  async listByOwner(ownerId: string): Promise<CommunityRecord[]> {
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

  async update(
    communityId: string,
    dto: UpdateCommunityDto,
    requesterId: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: community, error: fetchError } = await supabase
      .from('communities')
      .select('owner_id')
      .eq('id', communityId)
      .single();
    if (fetchError || !community) {
      throw new NotFoundException('Community not found');
    }
    if (community.owner_id !== requesterId) {
      throw new ForbiddenException('Only the owner can update this community');
    }
    const updates: Partial<Pick<CommunityRecord, 'name' | 'description'>> = {
      name: dto.name,
      description: dto.description,
    };
    if (dto.name !== undefined) {
      updates.name = dto.name;
    }
    if (dto.description !== undefined) {
      updates.description = dto.description;
    }
    const { error } = await supabase
      .from('communities')
      .update(updates)
      .eq('id', communityId);
    if (error) {
      throw new NotFoundException('Failed to update community');
    }
  }

  async delete(communityId: string, requesterId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: community, error: fetchError } = await supabase
      .from('communities')
      .select('owner_id')
      .eq('id', communityId)
      .single();
    if (fetchError || !community) {
      throw new NotFoundException('Community not found');
    }
    if (community.owner_id !== requesterId) {
      throw new ForbiddenException('Only the owner can delete this community');
    }
    const { error: linkError } = await supabase
      .from('groups')
      .update({ community_id: null })
      .eq('community_id', communityId);
    if (linkError) {
      throw new NotFoundException('Failed to unlink groups');
    }
    const { error: deleteError } = await supabase
      .from('communities')
      .delete()
      .eq('id', communityId);
    if (deleteError) {
      throw new NotFoundException('Failed to delete community');
    }
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

  async getGroups(communityId: string): Promise<GroupRecord[]> {
    await this.findById(communityId);
    return this.groupsService.getGroupsByCommunity(communityId);
  }
}
