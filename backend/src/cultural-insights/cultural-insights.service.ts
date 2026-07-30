import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class CulturalInsightsService {
  private readonly supabase;

  constructor(private readonly supabaseService: SupabaseService) {
    this.supabase = this.supabaseService.getClient();
  }

  async createTag(momentId: string, tagName: string) {
    const { data, error } = await this.supabase
      .from('cultural_tags')
      .insert({ moment_id: momentId, tag_name: tagName })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getTagsForMoment(momentId: string) {
    const { data, error } = await this.supabase
      .from('cultural_tags')
      .select('*')
      .eq('moment_id', momentId);
    if (error) throw error;
    return data;
  }

  async searchMomentsByTags(tags: string[]) {
    if (!tags.length) return [];
    const { data, error } = await this.supabase
      .from('cultural_tags')
      .select('moment_id')
      .in('tag_name', tags);
    if (error) throw error;
    const momentIds = data.map((r: any) => r.moment_id);
    if (!momentIds.length) return [];
    const { data: moments, error: momError } = await this.supabase
      .from('moments')
      .select('*')
      .in('id', momentIds);
    if (momError) throw momError;
    return moments;
  }
}
