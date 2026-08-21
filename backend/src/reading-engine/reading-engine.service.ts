import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  SupabaseService,
  ReadingResourceRow,
  ReadingProgressRow,
} from '../supabase/supabase.service';
import { ReadingEngineCacheService } from './reading-engine-cache.service';
import { ReadingEngineCrashReportService } from './reading-engine-crash-report.service';
import { ReadingEngineCacheNamespace } from './interfaces/cache-rules.interface';
import { CreateReadingResourceDto } from './dto/create-reading-resource.dto';
import { UpdateReadingResourceDto } from './dto/update-reading-resource.dto';
import {
  ReadingResource,
  ReadingProgress,
  ReadingTokenBreakdown,
  ReadingSession,
} from './interfaces/reading.interface';
import { sanitiseReadingEngineData } from './sanitise-reading-engine.helper';

@Injectable()
export class ReadingEngineService {
  private readonly logger = new Logger(ReadingEngineService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly cacheService: ReadingEngineCacheService,
    @Optional()
    private readonly crashReportService:
      ReadingEngineCrashReportService | undefined,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private async reportServiceCrash(
    operation: string,
    error: unknown,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const err = error instanceof Error ? error : new Error(String(error));
    await this.crashReportService?.reportCrash({
      operation,
      error_type: err.constructor.name,
      error_message: err.message,
      stack_trace: err.stack,
      context,
    });
  }

  private get db() {
    return this.supabaseService.getClient();
  }

  /* ------------------------------------------------------------------ */
  /*  Reading Resources                                                 */
  /* ------------------------------------------------------------------ */

  async createResource(
    userId: string,
    dto: CreateReadingResourceDto,
  ): Promise<ReadingResource> {
    const sanitised = sanitiseReadingEngineData(dto);
    const { data, error } = await this.db
      .from('reading_resources')
      .insert({
        title: sanitised.title,
        content: sanitised.content,
        language: sanitised.language,
        difficulty: sanitised.difficulty ?? null,
        topic: sanitised.topic ?? null,
        source_url: sanitised.sourceUrl ?? null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Could not create resource');

    this.eventEmitter.emit('reading.resource_mutated');
    return this.toResource(data);
  }

  async updateResource(
    resourceId: string,
    dto: UpdateReadingResourceDto,
  ): Promise<ReadingResource> {
    const sanitised = sanitiseReadingEngineData(dto);
    const update: Partial<ReadingResourceRow> = {};
    if (sanitised.title !== undefined) update.title = sanitised.title;
    if (sanitised.content !== undefined) update.content = sanitised.content;
    if (sanitised.language !== undefined) update.language = sanitised.language;
    if (sanitised.difficulty !== undefined)
      update.difficulty = sanitised.difficulty;
    if (sanitised.topic !== undefined) update.topic = sanitised.topic;
    if (sanitised.sourceUrl !== undefined)
      update.source_url = sanitised.sourceUrl;

    const { data, error } = await this.db
      .from('reading_resources')
      .update(update)
      .eq('id', resourceId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Resource not found');

    this.eventEmitter.emit('reading.resource_mutated');
    return this.toResource(data);
  }

  async getResource(resourceId: string): Promise<ReadingResource> {
    const cacheKey = this.cacheService.buildKey({
      namespace: ReadingEngineCacheNamespace.RESOURCE,
      userId: 'public',
      resourceId,
    });

    const cached = await this.cacheService.get<ReadingResource>(cacheKey);
    if (cached) return cached;

    const { data, error } = await this.db
      .from('reading_resources')
      .select()
      .eq('id', resourceId)
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Resource not found');

    const resource = this.toResource(data);
    await this.cacheService.set(cacheKey, resource);
    return resource;
  }

  private static readonly MAX_LIST_LIMIT = 100;
  private static readonly DEFAULT_LIST_LIMIT = 20;

  async listResources(params: {
    language?: string;
    difficulty?: string;
    topic?: string;
    limit?: number;
    offset?: number;
  }): Promise<ReadingResource[]> {
    const sanitisedLimit = Math.min(
      Math.max(1, params.limit ?? ReadingEngineService.DEFAULT_LIST_LIMIT),
      ReadingEngineService.MAX_LIST_LIMIT,
    );
    const sanitisedOffset = Math.max(0, params.offset ?? 0);

    let query = this.db
      .from('reading_resources')
      .select()
      .order('created_at', { ascending: false });

    if (params.language) query = query.eq('language', params.language);
    if (params.difficulty) query = query.eq('difficulty', params.difficulty);
    if (params.topic) query = query.eq('topic', params.topic);
    const effectiveLimit = params.limit ?? 20;
    if (params.offset !== undefined) {
      query = query.range(params.offset, params.offset + effectiveLimit - 1);
    } else if (params.limit !== undefined) {
      query = query.limit(params.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    if (rows.length > ReadingEngineService.MAX_LIST_LIMIT) {
      this.logger.warn(
        {
          requestedLimit: params.limit,
          enforcedLimit: sanitisedLimit,
          actualRows: rows.length,
        },
        'Supabase returned more rows than the enforced limit; possible RLS bypass',
      );
    }
    return rows.slice(0, sanitisedLimit).map((row) => this.toResource(row));
  }

  async deleteResource(resourceId: string): Promise<void> {
    const { error } = await this.db
      .from('reading_resources')
      .delete()
      .eq('id', resourceId);

    if (error) throw error;
    this.eventEmitter.emit('reading.resource_mutated');
  }

  /* ------------------------------------------------------------------ */
  /*  Token Breakdown                                                   */
  /* ------------------------------------------------------------------ */

  async tokenise(
    userId: string,
    resourceId: string,
    language?: string,
  ): Promise<ReadingTokenBreakdown> {
    const cacheKey = this.cacheService.buildKey({
      namespace: ReadingEngineCacheNamespace.TOKEN,
      userId,
      resourceId,
      extra: language,
    });

    const cached = await this.cacheService.get<ReadingTokenBreakdown>(cacheKey);
    if (cached) return cached;

    const resource = await this.getResource(resourceId);
    const locale = language ?? resource.language ?? 'en';

    const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
    const tokens = Array.from(segmenter.segment(resource.content))
      .filter((s) => s.isWordLike)
      .map((s, i) => ({
        index: i,
        token: s.segment,
        position: s.index,
        isWordLike: s.isWordLike ?? true,
      }));

    const breakdown: ReadingTokenBreakdown = {
      resourceId,
      language: locale,
      totalTokens: tokens.length,
      uniqueTokens: new Set(tokens.map((t) => t.token.toLowerCase())).size,
      tokens,
    };

    await this.cacheService.set(cacheKey, breakdown);
    return breakdown;
  }

  /* ------------------------------------------------------------------ */
  /*  Reading Progress                                                  */
  /* ------------------------------------------------------------------ */

  async getProgress(userId: string): Promise<ReadingProgress> {
    const cacheKey = this.cacheService.buildKey({
      namespace: ReadingEngineCacheNamespace.PROGRESS,
      userId,
    });

    const cached = await this.cacheService.get<ReadingProgress>(cacheKey);
    if (cached) return cached;

    const { data, error } = await this.db
      .from('reading_progress')
      .select()
      .eq('user_id', userId)
      .single();

    const progress: ReadingProgress = data
      ? {
          userId,
          wordsRead: data.words_read ?? 0,
          articlesCompleted: data.articles_completed ?? 0,
          totalReadingTimeSeconds: data.total_reading_time_seconds ?? 0,
          fluencyPercentage: data.fluency_percentage ?? 0,
          lastReadAt: data.last_read_at ?? null,
        }
      : {
          userId,
          wordsRead: 0,
          articlesCompleted: 0,
          totalReadingTimeSeconds: 0,
          fluencyPercentage: 0,
        };

    if (!error || error.code === 'PGRST116') {
      await this.cacheService.set(cacheKey, progress);
    }
    if (error && error.code !== 'PGRST116') throw error;

    return progress;
  }

  async recordSession(
    userId: string,
    session: { resourceId: string; wordsRead: number; durationSeconds: number },
  ): Promise<ReadingProgress> {
    const { data, error } = await this.db.rpc('upsert_reading_progress', {
      p_user_id: userId,
      p_resource_id: session.resourceId,
      p_words_read: session.wordsRead,
      p_duration_seconds: session.durationSeconds,
    });

    if (error) throw error;
    this.eventEmitter.emit('reading.reading_completed', { userId });

    // Fetch and cache updated progress
    return this.computeAndCacheProgress(userId);
  }

  private async computeAndCacheProgress(
    userId: string,
  ): Promise<ReadingProgress> {
    const { data } = await this.db
      .from('reading_progress')
      .select()
      .eq('user_id', userId)
      .single();

    const progress: ReadingProgress = data
      ? {
          userId,
          wordsRead: data.words_read ?? 0,
          articlesCompleted: data.articles_completed ?? 0,
          totalReadingTimeSeconds: data.total_reading_time_seconds ?? 0,
          fluencyPercentage: data.fluency_percentage ?? 0,
          lastReadAt: data.last_read_at ?? null,
        }
      : {
          userId,
          wordsRead: 0,
          articlesCompleted: 0,
          totalReadingTimeSeconds: 0,
          fluencyPercentage: 0,
        };

    const cacheKey = this.cacheService.buildKey({
      namespace: ReadingEngineCacheNamespace.PROGRESS,
      userId,
    });
    await this.cacheService.set(cacheKey, progress);
    return progress;
  }

  /* ------------------------------------------------------------------ */
  /*  Translation Caching                                               */
  /* ------------------------------------------------------------------ */

  async getCachedTranslation(
    userId: string,
    text: string,
    targetLanguage: string,
  ): Promise<string | null> {
    const cacheKey = this.cacheService.buildKey({
      namespace: ReadingEngineCacheNamespace.TRANSLATION,
      userId,
      extra: `${targetLanguage}:${Buffer.from(text).toString('base64').slice(0, 64)}`,
    });
    return this.cacheService.get<string>(cacheKey);
  }

  async cacheTranslation(
    userId: string,
    text: string,
    targetLanguage: string,
    translation: string,
  ): Promise<void> {
    const cacheKey = this.cacheService.buildKey({
      namespace: ReadingEngineCacheNamespace.TRANSLATION,
      userId,
      extra: `${targetLanguage}:${Buffer.from(text).toString('base64').slice(0, 64)}`,
    });
    await this.cacheService.set(cacheKey, translation);
    this.eventEmitter.emit('reading.translation_requested', { userId });
  }

  /* ------------------------------------------------------------------ */
  /*  Bulk User Clear                                                   */
  /* ------------------------------------------------------------------ */

  async clearUserCaches(userId: string): Promise<void> {
    this.eventEmitter.emit('reading.user_data_cleared', { userId });
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  private toResource(row: unknown): ReadingResource {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      title: r.title as string,
      content: r.content as string,
      language: r.language as string,
      difficulty: (r.difficulty as string) ?? undefined,
      topic: (r.topic as string) ?? undefined,
      sourceUrl: (r.source_url as string) ?? undefined,
      createdBy: (r.created_by as string) ?? '',
      createdAt: (r.created_at as string) ?? '',
      updatedAt: (r.updated_at as string) ?? '',
    };
  }
}
