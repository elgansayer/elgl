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
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findAll(userId: string): Promise<Resource[]> {
    const { data, error } = await this.client
      .from('resource_library')
      .select()
      .eq('created_by', userId);

    if (error) throw error;
    return data ?? [];
  }

  async findOne(id: string): Promise<Resource> {
    const { data, error } = await this.client
      .from('resource_library')
      .select()
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Resource not found');
    return data;
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
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Resource not found');
    return data;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client
      .from('resource_library')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
