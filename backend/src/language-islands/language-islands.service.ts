import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateLanguageIslandDto } from './dto/create-language-island.dto';
import { UpdateLanguageIslandDto } from './dto/update-language-island.dto';
import { QueryLanguageIslandsDto } from './dto/query-language-islands.dto';

export interface LanguageIslandRow {
  id: string;
  name: string;
  description: string | null;
  language_pair: string;
  host_id: string;
  max_members: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface _LanguageIslandMemberRow {
  island_id: string;
  user_id: string;
  role: 'host' | 'member';
  joined_at: string;
}

type LanguageIslandWithCount = LanguageIslandRow & { member_count: number };

@Injectable()
export class LanguageIslandsService {
  private readonly logger = new Logger(LanguageIslandsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async list(
    query: QueryLanguageIslandsDto,
    currentUserId?: string,
  ): Promise<LanguageIslandRow[]> {
    const client = this.supabaseService.getClient();
    let builder = client
      .from('language_islands')
      .select('*')
      .eq('is_active', true);

    if (query.language_pair) {
      builder = builder.eq('language_pair', query.language_pair);
    }

    if (query.host_only && currentUserId) {
      builder = builder.eq('host_id', currentUserId);
    }

    const page = query.page ?? 0;
    const limit = query.limit ?? 50;

    builder = builder
      .order('created_at', { ascending: false })
      .range(page * limit, page * limit + limit - 1);

    const { data, error } = await builder;

    if (error) {
      this.logger.error(`Failed to list language islands: ${error.message}`);
      throw new InternalServerErrorException('Failed to list language islands');
    }

    const islands = data ?? [];
    return this.decorateWithMemberCounts(islands);
  }

  async getById(id: string): Promise<LanguageIslandRow> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('language_islands')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Language island not found');
    }

    const [decorated] = await this.decorateWithMemberCounts([data]);
    return decorated;
  }

  async create(
    dto: CreateLanguageIslandDto,
    hostUserId: string,
  ): Promise<LanguageIslandRow> {
    const client = this.supabaseService.getClient();

    const { data: island, error: insertError } = await client
      .from('language_islands')
      .insert({
        name: dto.name,
        description: dto.description ?? null,
        language_pair: dto.language_pair,
        host_id: hostUserId,
        max_members: dto.max_members ?? null,
        is_active: true,
      })
      .select()
      .single();

    if (insertError || !island) {
      this.logger.error(
        `Failed to create language island: ${insertError?.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to create language island',
      );
    }

    const islandRow = island;

    const { error: memberError } = await client
      .from('language_island_members')
      .insert({
        island_id: islandRow.id,
        user_id: hostUserId,
        role: 'host',
      });

    if (memberError) {
      this.logger.error(`Failed to add island host: ${memberError.message}`);
      throw new InternalServerErrorException(
        'Failed to create island host membership',
      );
    }

    const [decorated] = await this.decorateWithMemberCounts([islandRow]);
    return decorated;
  }

  async update(
    id: string,
    dto: UpdateLanguageIslandDto,
    userId: string,
  ): Promise<LanguageIslandRow> {
    const existing = await this.getById(id);

    if (existing.host_id !== userId) {
      throw new ForbiddenException(
        'Only the host can update this language island',
      );
    }

    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('language_islands')
      .update({
        name: dto.name ?? existing.name,
        description:
          dto.description !== undefined
            ? dto.description
            : existing.description,
        language_pair: dto.language_pair ?? existing.language_pair,
        max_members:
          dto.max_members !== undefined
            ? dto.max_members
            : existing.max_members,
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`Failed to update language island: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to update language island',
      );
    }

    const [decorated] = await this.decorateWithMemberCounts([data]);
    return decorated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const existing = await this.getById(id);

    if (existing.host_id !== userId) {
      throw new ForbiddenException(
        'Only the host can delete this language island',
      );
    }

    const client = this.supabaseService.getClient();

    const { error: memberError } = await client
      .from('language_island_members')
      .delete()
      .eq('island_id', id);

    if (memberError) {
      throw new InternalServerErrorException('Failed to remove island members');
    }

    const { error: islandError } = await client
      .from('language_islands')
      .delete()
      .eq('id', id);

    if (islandError) {
      throw new InternalServerErrorException(
        'Failed to delete language island',
      );
    }
  }

  async join(id: string, userId: string): Promise<void> {
    const client = this.supabaseService.getClient();

    const { data: island } = await client
      .from('language_islands')
      .select('max_members')
      .eq('id', id)
      .single();

    if (!island) {
      throw new NotFoundException('Language island not found');
    }

    if (island.max_members !== null) {
      const { count } = await client
        .from('language_island_members')
        .select('*', { count: 'exact', head: true })
        .eq('island_id', id);

      if (count !== null && count >= island.max_members) {
        throw new BadRequestException('Language island is full');
      }
    }

    const { data: existing } = await client
      .from('language_island_members')
      .select()
      .eq('island_id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return;
    }

    const { error } = await client.from('language_island_members').insert({
      island_id: id,
      user_id: userId,
      role: 'member',
    });

    if (error) {
      this.logger.error(`Failed to join language island: ${error.message}`);
      throw new InternalServerErrorException('Failed to join language island');
    }
  }

  async leave(id: string, userId: string): Promise<void> {
    const client = this.supabaseService.getClient();

    const { error } = await client
      .from('language_island_members')
      .delete()
      .eq('island_id', id)
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to leave language island: ${error.message}`);
      throw new InternalServerErrorException('Failed to leave language island');
    }
  }

  async getMyIslands(userId: string): Promise<LanguageIslandRow[]> {
    const client = this.supabaseService.getClient();

    const { data: memberships, error: memberError } = await client
      .from('language_island_members')
      .select('island_id')
      .eq('user_id', userId);

    if (memberError || !memberships) {
      return [];
    }

    const islandIds = memberships.map((m) => m.island_id);

    if (islandIds.length === 0) {
      return [];
    }

    const { data: islands, error: islandsError } = await client
      .from('language_islands')
      .select('*')
      .in('id', islandIds);

    if (islandsError || !islands) {
      return [];
    }

    return this.decorateWithMemberCounts(islands);
  }

  private async decorateWithMemberCounts(
    islands: LanguageIslandRow[],
  ): Promise<LanguageIslandWithCount[]> {
    if (islands.length === 0) {
      return [];
    }

    const client = this.supabaseService.getClient();
    const islandIds = islands.map((i) => i.id);

    const { data, error } = await client
      .from('language_island_members')
      .select('island_id')
      .in('island_id', islandIds);

    if (error || !data) {
      this.logger.warn(`Failed to load member counts: ${error?.message}`);
      return islands.map((i) => ({ ...i, member_count: 0 }));
    }

    const countMap = data.reduce<Record<string, number>>((acc, membership) => {
      const islandId = membership.island_id;
      acc[islandId] = (acc[islandId] ?? 0) + 1;
      return acc;
    }, {});

    return islands.map((island) => ({
      ...island,
      member_count: countMap[island.id] ?? 0,
    }));
  }
}
