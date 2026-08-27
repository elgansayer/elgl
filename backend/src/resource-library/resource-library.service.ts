import { Injectable, NotFoundException } from '@nestjs/common';
import { Resource } from './interfaces/resource.interface';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ResourceLibraryService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  private toResource(data: unknown): Resource {
    if (typeof data !== 'object' || data === null) {
      throw new Error('Invalid resource data');
    }
    const row = data as {
      id: string;
      title: string;
      description: string | null;
      url: string;
      category: string | null;
      content: string | null;
      topic: string | null;
      difficulty: string | null;
      type?: string | null;
      created_by: string;
      created_at: string;
      updated_at: string;
    };
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      url: row.url,
      category: row.category ?? undefined,
      content: row.content ?? undefined,
      topic: row.topic ?? undefined,
      difficulty: row.difficulty ?? undefined,
      type: row.type ?? undefined,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async create(userId: string, dto: CreateResourceDto): Promise<Resource> {
    const { data, error } = await this.client
      .from('resource_library')
      .insert({
        title: dto.title,
        description: dto.description ?? null,
        url: dto.url,
        category: dto.category ?? null,
        created_by: userId,
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.topic !== undefined && { topic: dto.topic }),
        ...(dto.difficulty !== undefined && { difficulty: dto.difficulty }),
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Resource not found');
    return this.toResource(data);
  }

  async findAll(
    userId: string,
    filter?: { topic?: string; difficulty?: string },
  ): Promise<Resource[]> {
    let query = this.client
      .from('resource_library')
      .select()
      .eq('created_by', userId);

    if (filter?.topic) {
      query = query.eq('topic', filter.topic);
    }
    if (filter?.difficulty) {
      query = query.eq('difficulty', filter.difficulty);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data ?? []).map((row) => this.toResource(row));
  }

  async findOne(id: string): Promise<Resource> {
    const { data, error } = await this.client
      .from('resource_library')
      .select()
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Resource not found');
    return this.toResource(data);
  }

  async update(id: string, dto: UpdateResourceDto): Promise<Resource> {
    const { data, error } = await this.client
      .from('resource_library')
      .update({
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.url !== undefined && { url: dto.url }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.topic !== undefined && { topic: dto.topic }),
        ...(dto.difficulty !== undefined && { difficulty: dto.difficulty }),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Resource not found');
    return this.toResource(data);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client
      .from('resource_library')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
