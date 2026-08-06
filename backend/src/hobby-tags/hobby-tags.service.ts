import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface TargetVocabularyItem {
  word: string;
  translation: string;
  language: string;
}

export interface VocabularyResultItem {
  id: string;
  word: string;
  translation: string;
  hobbyTagName: string;
  difficulty: string;
  context_sentence?: string;
  hobby_tag: { icon: string; name: string };
}

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

  async createTag(
    name: string,
    category: string,
    icon: string = '✨',
  ): Promise<any> {
    const formattedName = name
      .trim()
      .split(/\s+/)
      .map((word, index) => {
        if (index === 0) return word.toLowerCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('');

    const supabase = this.supabaseService.getClient();
    const insertResponse = await supabase
      .from('hobby_tags')
      .insert({
        name: formattedName,
        category,
        icon,
        target_vocabulary: [],
      })
      .select()
      .single();

    if (insertResponse.error) throw insertResponse.error;
    return insertResponse.data;
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
    proficiencyLevel?: number,
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
        proficiency_level: proficiencyLevel || 0,
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
    proficiencyLevel: number,
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

  async getVocabularyForUser(
    userId: string,
    language: string,
  ): Promise<VocabularyResultItem[]> {
    const supabase = this.supabaseService.getClient();
    const { data: userHobbyTags, error } = await supabase
      .from('user_hobby_tags')
      .select(
        `
        *,
        hobby_tag:hobby_tags(*)
      `,
      )
      .eq('user_id', userId);

    if (error) throw error;
    if (!userHobbyTags || userHobbyTags.length === 0) return [];

    const results: VocabularyResultItem[] = [];

    for (const uht of userHobbyTags) {
      const hobbyTag = uht.hobby_tag;
      if (!hobbyTag) continue;

      const targetVocab: TargetVocabularyItem[] = Array.isArray(hobbyTag.target_vocabulary)
        ? hobbyTag.target_vocabulary
        : [];

      const filteredVocab = targetVocab.filter(
        (v) => v.language === language,
      );

      for (const vocabItem of filteredVocab) {
        results.push({
          id: `${uht.id}-${vocabItem.word}`,
          word: vocabItem.word,
          translation: vocabItem.translation,
          hobbyTagName: hobbyTag.name,
          difficulty: 'beginner',
          context_sentence: undefined,
          hobby_tag: {
            icon: hobbyTag.icon || '🎯',
            name: hobbyTag.name,
          },
        });
      }
    }

    return results;
  }
}
