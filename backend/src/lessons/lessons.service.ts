import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService, type LessonRow } from '../supabase/supabase.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { UpdateLessonProgressDto } from './dto/update-lesson-progress.dto';

export type LessonVisibility = 'public' | 'vip' | 'hidden';

export interface LessonRecord {
  id: string;
  title: string;
  description?: string | null;
  content_json?: Record<string, unknown> | null;
  language_code: string;
  difficulty_level?: number | null;
  cover_image_url?: string | null;
  audio_url?: string | null;
  is_published?: boolean;
  visibility?: LessonVisibility;
  sort_order?: number;
  created_at?: string;
  updated_at?: string | null;
}

export interface LessonProgressRecord {
  progress_percent: number;
  last_position: number;
  completed: boolean;
  completed_at: string | null;
}

export interface LearnerLessonRecord extends LessonRecord {
  progress: LessonProgressRecord;
}

type LessonProgressRow = {
  user_id: string;
  lesson_id: string;
  progress_percent: number;
  last_position: number;
  completed_at: string | null;
  started_at?: string;
  updated_at?: string;
};

const EMPTY_PROGRESS: LessonProgressRecord = {
  progress_percent: 0,
  last_position: 0,
  completed: false,
  completed_at: null,
};

@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name);

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

  async getLesson(id: string): Promise<LessonRecord> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
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

  async listLearnerLessons(
    userId: string,
    language?: string,
  ): Promise<LearnerLessonRecord[]> {
    const supabase = this.supabaseService.getClient() as any;
    const isVip = await this.isVipUser(userId);

    let query = supabase
      .from('lessons')
      .select(
        'id,title,description,language_code,difficulty_level,cover_image_url,audio_url,is_published,visibility,sort_order,created_at,updated_at',
      )
      .eq('is_published', true)
      .neq('visibility', 'hidden');

    if (!isVip) {
      query = query.neq('visibility', 'vip');
    }
    if (language) {
      query = query.eq('language_code', language);
    }

    const { data, error } = await query
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      this.logger.error(`Failed to list learner lessons: ${error.message}`);
      throw error;
    }

    const lessons = (data ?? []) as LessonRecord[];
    const progress = await this.getProgressForLessons(
      userId,
      lessons.map((lesson) => lesson.id),
    );

    return lessons.map((lesson) => ({
      ...lesson,
      progress: progress.get(lesson.id) ?? { ...EMPTY_PROGRESS },
    }));
  }

  async getLearnerLesson(
    userId: string,
    lessonId: string,
  ): Promise<LearnerLessonRecord> {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', lessonId)
      .eq('is_published', true)
      .neq('visibility', 'hidden')
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to load learner lesson ${lessonId}: ${error.message}`);
      throw error;
    }
    if (!data) {
      throw new NotFoundException('Lesson not found');
    }

    const lesson = data as LessonRecord;
    if (lesson.visibility === 'vip' && !(await this.isVipUser(userId))) {
      // Do not disclose the existence of entitlement-gated lesson content.
      throw new NotFoundException('Lesson not found');
    }

    const progress = await this.getProgressForLessons(userId, [lessonId]);
    return {
      ...lesson,
      progress: progress.get(lessonId) ?? { ...EMPTY_PROGRESS },
    };
  }

  async updateLearnerProgress(
    userId: string,
    lessonId: string,
    dto: UpdateLessonProgressDto,
  ): Promise<LessonProgressRecord> {
    // Authorize against the same published/visibility rules used by reads before
    // mutating progress so hidden or VIP-only lesson identifiers cannot be probed.
    await this.getLearnerLesson(userId, lessonId);

    const supabase = this.supabaseService.getClient() as any;
    const { error: rpcError } = await supabase.rpc('upsert_lesson_progress', {
      p_user_id: userId,
      p_lesson_id: lessonId,
      p_progress_percent: dto.progressPercent ?? 0,
      p_last_position: dto.lastPosition ?? 0,
      p_complete: dto.completed ?? false,
    });

    if (rpcError) {
      this.logger.error(
        `Failed to update learner progress for lesson ${lessonId}: ${rpcError.message}`,
      );
      throw rpcError;
    }

    const { data, error } = await supabase
      .from('lesson_progress')
      .select(
        'user_id,lesson_id,progress_percent,last_position,completed_at,started_at,updated_at',
      )
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .single();

    if (error || !data) {
      if (error) {
        this.logger.error(
          `Failed to read updated learner progress for lesson ${lessonId}: ${error.message}`,
        );
        throw error;
      }
      throw new Error('Lesson progress update did not return a row');
    }

    return this.toProgressRecord(data as LessonProgressRow);
  }

  async completeLesson(userId: string, lessonId: string): Promise<void> {
    await this.updateLearnerProgress(userId, lessonId, { completed: true });
  }

  private async isVipUser(userId: string): Promise<boolean> {
    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('users')
      .select('is_vip')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      // Entitlement lookup fails closed: public lessons remain available while
      // VIP-only content is never exposed on an uncertain authorization state.
      this.logger.warn(`VIP entitlement lookup failed: ${error.message}`);
      return false;
    }

    return data?.is_vip === true;
  }

  private async getProgressForLessons(
    userId: string,
    lessonIds: string[],
  ): Promise<Map<string, LessonProgressRecord>> {
    if (lessonIds.length === 0) return new Map();

    const supabase = this.supabaseService.getClient() as any;
    const { data, error } = await supabase
      .from('lesson_progress')
      .select('lesson_id,progress_percent,last_position,completed_at')
      .eq('user_id', userId)
      .in('lesson_id', lessonIds);

    if (error) {
      this.logger.error(`Failed to load learner lesson progress: ${error.message}`);
      throw error;
    }

    return new Map(
      ((data ?? []) as LessonProgressRow[]).map((row) => [
        row.lesson_id,
        this.toProgressRecord(row),
      ]),
    );
  }

  private toProgressRecord(row: LessonProgressRow): LessonProgressRecord {
    return {
      progress_percent: row.progress_percent,
      last_position: row.last_position,
      completed: row.completed_at !== null || row.progress_percent >= 100,
      completed_at: row.completed_at,
    };
  }
}
