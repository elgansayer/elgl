import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { XpService } from '../xp/xp.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

@Injectable()
export class LessonsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly xpService: XpService,
  ) {}

  async listLessons(): Promise<any[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getLesson(id: string): Promise<any> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async createLesson(dto: CreateLessonDto): Promise<any> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('lessons')
      .insert({
        title: dto.title,
        description: dto.description,
        content_json: dto.content_json,
        language_code: dto.language_code,
        difficulty_level: dto.difficulty_level,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateLesson(id: string, dto: UpdateLessonDto): Promise<any> {
    const supabase = this.supabaseService.getClient();
    const updates: any = {};
    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.content_json !== undefined) updates.content_json = dto.content_json;
    if (dto.language_code !== undefined)
      updates.language_code = dto.language_code;
    if (dto.difficulty_level !== undefined)
      updates.difficulty_level = dto.difficulty_level;
    const { data, error } = await supabase
      .from('lessons')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
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

    await this.xpService.awardXpForActivity(userId, 'complete_lesson');
  }
}
