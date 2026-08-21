import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { CreateDialogueDto } from './dto/create-dialogue.dto';

@Injectable()
export class CuratedContentService {
  constructor(private readonly supabase: SupabaseService) {}

  private get client(): any {
    return this.supabase.getClient() as any;
  }

  async getArticles(language?: string, cefrLevel?: string) {
    let query = this.client.from('curated_articles').select('*');

    if (language) {
      query = query.eq('language', language);
    }
    if (cefrLevel) {
      query = query.eq('cefr_level', cefrLevel);
    }

    const { data, error } = await query.order('created_at', {
      ascending: false,
    });
    if (error) throw error;
    return data;
  }

  async getArticleById(id: string) {
    const { data, error } = await this.client
      .from('curated_articles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Article not found');
    return data;
  }

  async createArticle(dto: CreateArticleDto) {
    const { data, error } = await this.client
      .from('curated_articles')
      .insert({
        title: dto.title,
        cefr_level: dto.cefrLevel,
        language: dto.language,
        source_url: dto.sourceUrl,
        content_text: dto.contentText,
        word_count: dto.wordCount,
        difficulty_rating: dto.difficultyRating,
        audio_url: dto.audioUrl,
        image_url: dto.imageUrl,
        tags: dto.tags,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getDialogues(language?: string, cefrLevel?: string) {
    let query = this.client.from('curated_dialogues').select('*');

    if (language) {
      query = query.eq('language', language);
    }
    if (cefrLevel) {
      query = query.eq('cefr_level', cefrLevel);
    }

    const { data, error } = await query.order('created_at', {
      ascending: false,
    });
    if (error) throw error;
    return data;
  }

  async getDialogueById(id: string) {
    const { data, error } = await this.client
      .from('curated_dialogues')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Dialogue not found');
    return data;
  }

  async createDialogue(dto: CreateDialogueDto) {
    const { data, error } = await this.client
      .from('curated_dialogues')
      .insert({
        title: dto.title,
        cefr_level: dto.cefrLevel,
        language: dto.language,
        source_url: dto.sourceUrl,
        lines: dto.lines,
        audio_url: dto.audioUrl,
        image_url: dto.imageUrl,
        tags: dto.tags,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
