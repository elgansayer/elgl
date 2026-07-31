import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

export interface LessonRecord {
  id: string;
  title: string;
  description?: string;
  content_json?: Record<string, unknown>;
  language_code: string;
  difficulty_level?: number;
  cover_image_url?: string;
  audio_url?: string;
  created_at: string;
  updated_at?: string;
}

@Injectable()
export class LessonsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async listLessons(): Promise<LessonRecord[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as LessonRecord[];
  }

  async getLesson(id: string): Promise<LessonRecord> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as LessonRecord;
  }

  async createLesson(dto: CreateLessonDto): Promise<LessonRecord> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('lessons')
      .insert({
        title: dto.title,
        description: dto.description,
        content_json: dto.content_json,
        language_code: dto.language_code,
        difficulty_level: dto.difficulty_level,
        cover_image_url: dto.cover_image_url,
        audio_url: dto.audio_url,
      })
      .select()
      .single();

    if (error) throw error;
    return data as LessonRecord;
  }

  async updateLesson(id: string, dto: UpdateLessonDto): Promise<LessonRecord> {
    const supabase = this.supabaseService.getClient();
    const updates: Record<string, unknown> = {};
    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.content_json !== undefined) updates.content_json = dto.content_json;
    if (dto.language_code !== undefined)
      updates.language_code = dto.language_code;
    if (dto.difficulty_level !== undefined)
      updates.difficulty_level = dto.difficulty_level;
    if (dto.cover_image_url !== undefined)
      updates.cover_image_url = dto.cover_image_url;
    if (dto.audio_url !== undefined) updates.audio_url = dto.audio_url;
    const { data, error } = await supabase
      .from('lessons')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as LessonRecord;
  }

  async deleteLesson(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('lessons').delete().eq('id', id);

    if (error) throw error;
  }

  async completeLesson(userId: string, lessonId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: lesson, error } = await supabase
      .from('lessons')
      .select('id')
      .eq('id', lessonId)
      .single();

    if (error || !lesson) {
      throw new NotFoundException(`Lesson ${lessonId} not found`);
    }
  }
}
