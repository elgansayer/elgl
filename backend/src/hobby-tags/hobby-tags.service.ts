import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class HobbyTagsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getAllTags(): Promise<any[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('hobby_tags')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getUserTags(userId: string): Promise<any[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('user_hobby_tags')
      .select(
        `
        *,
        hobby_tag:hobby_tags(*)
      `,
      )
      .eq('user_id', userId);

    if (error) throw error;
    return data || [];
  }

  async addUserTag(
    userId: string,
    hobbyTagId: string,
    proficiencyLevel?: string,
  ): Promise<any> {
    const supabase = this.supabaseService.getClient();

    // Verify hobby tag exists
    const { data: tag, error: tagError } = await supabase
      .from('hobby_tags')
      .select('id')
      .eq('id', hobbyTagId)
      .single();

    if (tagError || !tag) {
      throw new NotFoundException('Hobby tag not found');
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from('user_hobby_tags')
      .select('id')
      .eq('user_id', userId)
      .eq('hobby_tag_id', hobbyTagId)
      .single();

    if (existing) {
      throw new ConflictException('Hobby tag already added');
    }

    const insertResponse = await supabase
      .from('user_hobby_tags')
      .insert({
        user_id: userId,
        hobby_tag_id: hobbyTagId,
        proficiency_level: proficiencyLevel || 'beginner',
      })
      .select(
        `
        *,
        hobby_tag:hobby_tags(*)
      `,
      )
      .single();

    if (insertResponse.error) throw insertResponse.error;
    return insertResponse.data;
  }

  async removeUserTag(userId: string, hobbyTagId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('user_hobby_tags')
      .delete()
      .eq('user_id', userId)
      .eq('hobby_tag_id', hobbyTagId);

    if (error) throw error;
  }

  async updateProficiency(
    userId: string,
    hobbyTagId: string,
    proficiencyLevel: string,
  ): Promise<any> {
    const supabase = this.supabaseService.getClient();
    const updateResponse = await supabase
      .from('user_hobby_tags')
      .update({ proficiency_level: proficiencyLevel })
      .eq('user_id', userId)
      .eq('hobby_tag_id', hobbyTagId)
      .select(
        `
        *,
        hobby_tag:hobby_tags(*)
      `,
      )
      .single();

    if (updateResponse.error) throw updateResponse.error;
    if (!updateResponse.data)
      throw new NotFoundException('User hobby tag not found');
    return updateResponse.data;
  }
}
