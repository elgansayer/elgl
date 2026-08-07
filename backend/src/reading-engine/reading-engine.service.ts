import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseService, ReadingResourceRow, ReadingProgressRow } from '../supabase/supabase.service';
import { ReadingEngineCacheService } from './reading-engine-cache.service';
import { ReadingEngineCacheNamespace } from './interfaces/cache-rules.interface';
import { CreateReadingResourceDto } from './dto/create-reading-resource.dto';
import { UpdateReadingResourceDto } from './dto/update-reading-resource.dto';
import {
  ReadingResource,
  ReadingProgress,
  ReadingTokenBreakdown,
  ReadingSession,
} from './interfaces/reading.interface';

/** Default list page size to prevent unbounded query results. */
const DEFAULT_LIST_LIMIT = 50;
/** Hard cap on list results per request. */
const MAX_LIST_LIMIT = 200;
/** Max tokens returned per tokenise call to keep payload size bounded. */
const DEFAULT_TOKEN_LIMIT = 500;
/** Absolute cap on tokens returned in a single tokenise request. */
const MAX_TOKEN_LIMIT = 5_000;
/** Max content length in bytes we allow into the Redis cache (512 KB). */
const MAX_CACHEABLE_CONTENT_BYTES = 512 * 1024;

@Injectable()
export class ReadingEngineService {
  private readonly logger = new Logger(ReadingEngineService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly cacheService: ReadingEngineCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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
    const { data, error } = await this.db
      .from('reading_resources')
      .insert({
        title: dto.title,
        content: dto.content,
        language: dto.language,
        difficulty: dto.difficulty ?? null,
        topic: dto.topic ?? null,
        source_url: dto.sourceUrl ?? null,
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
    const update: Partial<ReadingResourceRow> = {};
    if (dto.title !== undefined) update.title = dto.title;
    if (dto.content !== undefined) update.content = dto.content;
    if (dto.language !== undefined) update.language = dto.language;
    if (dto.difficulty !== undefined) update.difficulty = dto.difficulty;
    if (dto.topic !== undefined) update.topic = dto.topic;
    if (dto.sourceUrl !== undefined) update.source_url = dto.sourceUrl;

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

    // Only cache resources whose content is below the size threshold
    const contentSize = Buffer.byteLength(resource.content, 'utf8');
    if (contentSize <= MAX_CACHEABLE_CONTENT_BYTES) {
      await this.cacheService.set(cacheKey, resource);
    } else {
      this.logger.debug(
        { resourceId, contentSize },
        'Skipping cache write -- content exceeds size threshold',
      );
    }

    return resource;
  }

  async listResources(params: {
    language?: string;
    difficulty?: string;
    topic?: string;
    limit?: number;
    offset?: number;
  }): Promise<ReadingResource[]> {
    const effectiveLimit = Math.min(
      Math.max(params.limit ?? DEFAULT_LIST_LIMIT, 1),
      MAX_LIST_LIMIT,
    );
    const effectiveOffset = Math.max(params.offset ?? 0, 0);

    let query = this.db
      .from('reading_resources')
      .select()
      .order('created_at', { ascending: false })
      .limit(effectiveLimit)
      .range(effectiveOffset, effectiveOffset + effectiveLimit - 1);

    if (params.language) query = query.eq('language', params.language);
    if (params.difficulty) query = query.eq('difficulty', params.difficulty);
    if (params.topic) query = query.eq('topic', params.topic);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => this.toResource(row));
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
    tokenLimit?: number,
    tokenOffset?: number,
  ): Promise<ReadingTokenBreakdown> {
    const effectiveLimit = Math.min(
      Math.max(tokenLimit ?? DEFAULT_TOKEN_LIMIT, 1),
      MAX_TOKEN_LIMIT,
    );
    const effectiveOffset = Math.max(tokenOffset ?? 0, 0);

    const cacheKey = this.cacheService.buildKey({
      namespace: ReadingEngineCacheNamespace.TOKEN,
      userId,
      resourceId,
      extra: `${language ?? 'auto'}:l${effectiveLimit}:o${effectiveOffset}`,
    });

    const cached = await this.cacheService.get<ReadingTokenBreakdown>(cacheKey);
    if (cached) return cached;

    const resource = await this.getResource(resourceId);
    const locale = language ?? resource.language ?? 'en';

    const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
    const allTokens = Array.from(segmenter.segment(resource.content))
      .filter((s) => s.isWordLike)
      .map((s, i) => ({
        index: i,
        token: s.segment,
        position: s.index,
        isWordLike: s.isWordLike ?? true,
      }));

    const totalTokens = allTokens.length;
    const uniqueTokens = new Set(allTokens.map((t) => t.token.toLowerCase())).size;
    const pagedTokens = allTokens.slice(effectiveOffset, effectiveOffset + effectiveLimit);

    const breakdown: ReadingTokenBreakdown = {
      resourceId,
      language: locale,
      totalTokens,
      uniqueTokens,
      tokens: pagedTokens,
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

  private async computeAndCacheProgress(userId: string): Promise<ReadingProgress> {
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