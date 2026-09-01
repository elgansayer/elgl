import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService, type LessonRow } from '../supabase/supabase.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

export interface LessonRecord {
  id: string;
  title: string;
  description?: string | null;
  content_json?: Record<string, unknown> | null;
  language_code: string;
  difficulty_level?: number | null;
  cover_image_url?: string | null;
  audio_url?: string | null;
  created_at?: string;
  updated_at?: string | null;
}

export interface LessonProgressRecord {
  lesson_id: string;
  segment_index: number;
  completed: boolean;
  completed_at: string | null;
  updated_at: string | null;
}

export interface RecentLessonRecord {
  id: string;
  title: string;
  language_code: string;
  encountered_at: string;
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
    return data ?? [];
  }

  async listRecentLessonsForUser(
    userId: string,
    language: string,
    limit = 5,
  ): Promise<RecentLessonRecord[]> {
    const safeLimit = Math.min(Math.max(1, limit), 20);
    const client = this.progressClient();
    const { data, error } = await client
      .from('lesson_progress')
      .select('lesson_id, updated_at, lessons!inner(id, title, language_code)')
      .eq('user_id', userId)
      .eq('lessons.language_code', language)
      .order('updated_at', { ascending: false })
      .limit(safeLimit);

    if (error) throw error;
    if (!Array.isArray(data)) return [];

    const rows = data as unknown[];
    return rows.flatMap((value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return [];
      }

      const row = value as Record<string, unknown>;
      const related = row['lessons'];
      const lesson: unknown = Array.isArray(related)
        ? (related as unknown[])[0]
        : related;
      if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) {
        return [];
      }

      const lessonRow = lesson as Record<string, unknown>;
      const id = lessonRow['id'];
      const title = lessonRow['title'];
      const languageCode = lessonRow['language_code'];
      const encounteredAt = row['updated_at'];
      if (
        typeof id !== 'string' ||
        typeof title !== 'string' ||
        typeof languageCode !== 'string' ||
        typeof encounteredAt !== 'string'
      ) {
        return [];
      }

      return [
        {
          id,
          title,
          language_code: languageCode,
          encountered_at: encounteredAt,
        },
      ];
    });
  }

  async getLesson(id: string): Promise<LessonRecord> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException(`Lesson ${id} not found`);
      }
      throw error;
    }
    if (!data) throw new NotFoundException(`Lesson ${id} not found`);
    return data;
  }

  async getLessonProgress(
    userId: string,
    lessonId: string,
  ): Promise<LessonProgressRecord> {
    await this.getLesson(lessonId);
    const client = this.progressClient();
    const { data, error } = await client
      .from('lesson_progress')
      .select('lesson_id, segment_index, completed, completed_at, updated_at')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return this.emptyProgress(lessonId);
    return this.normaliseProgress(data, lessonId);
  }

  async saveLessonProgress(
    userId: string,
    lessonId: string,
    segmentIndex: number,
    completed: boolean,
  ): Promise<LessonProgressRecord> {
    const lesson = await this.getLesson(lessonId);
    const maxSegmentIndex = this.maxSegmentIndex(lesson);
    if (segmentIndex > maxSegmentIndex) {
      throw new BadRequestException(
        'Lesson progress is outside the lesson content',
      );
    }
    if (completed && segmentIndex !== maxSegmentIndex) {
      throw new BadRequestException(
        'A lesson can only complete on its final segment',
      );
    }

    const client = this.progressClient();
    const now = new Date().toISOString();
    const { data, error } = await client
      .from('lesson_progress')
      .upsert(
        {
          user_id: userId,
          lesson_id: lessonId,
          segment_index: segmentIndex,
          completed,
          completed_at: completed ? now : null,
          updated_at: now,
        },
        { onConflict: 'user_id,lesson_id' },
      )
      .select('lesson_id, segment_index, completed, completed_at, updated_at')
      .single();

    if (error) throw error;
    if (!data) throw new Error('Lesson progress write returned no row');
    return this.normaliseProgress(data, lessonId);
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
    return data;
  }

  async updateLesson(id: string, dto: UpdateLessonDto): Promise<LessonRecord> {
    const supabase = this.supabaseService.getClient();
    const updates: Partial<LessonRow> = {};
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
    return data;
  }

  async deleteLesson(id: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('lessons').delete().eq('id', id);

    if (error) throw error;
  }

  async completeLesson(userId: string, lessonId: string): Promise<void> {
    const lesson = await this.getLesson(lessonId);
    await this.saveLessonProgress(
      userId,
      lessonId,
      this.maxSegmentIndex(lesson),
      true,
    );
  }

  private progressClient(): SupabaseClient {
    return this.supabaseService.getClient();
  }

  private emptyProgress(lessonId: string): LessonProgressRecord {
    return {
      lesson_id: lessonId,
      segment_index: 0,
      completed: false,
      completed_at: null,
      updated_at: null,
    };
  }

  private normaliseProgress(
    value: unknown,
    lessonId: string,
  ): LessonProgressRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Lesson progress response was malformed');
    }

    const record = value as Record<string, unknown>;
    const segmentIndex = record['segment_index'];
    const completed = record['completed'];
    const completedAt = record['completed_at'];
    const updatedAt = record['updated_at'];

    if (
      typeof segmentIndex !== 'number' ||
      !Number.isInteger(segmentIndex) ||
      segmentIndex < 0 ||
      typeof completed !== 'boolean' ||
      (completedAt !== null && typeof completedAt !== 'string') ||
      (updatedAt !== null && typeof updatedAt !== 'string')
    ) {
      throw new Error('Lesson progress response was malformed');
    }

    return {
      lesson_id: lessonId,
      segment_index: segmentIndex,
      completed,
      completed_at: completedAt,
      updated_at: updatedAt,
    };
  }

  private maxSegmentIndex(lesson: LessonRecord): number {
    const segments = lesson.content_json?.['segments'];
    if (!Array.isArray(segments)) return 0;
    const usableCount = segments.filter((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
      const text = (value as Record<string, unknown>)['text'];
      return typeof text === 'string' && text.trim().length > 0;
    }).length;
    return Math.max(0, usableCount - 1);
  }
}
