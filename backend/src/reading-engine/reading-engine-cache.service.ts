import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import {
  ReadingEngineCacheNamespace,
  CacheInvalidationRule,
  CacheInvalidationTrigger,
  CacheKeyOptions,
} from './interfaces/cache-rules.interface';

/**
 * Centralised Redis cache service for the LingQ Reading Engine.
 *
 * Responsibilities:
 * - Builds namespaced, user-scoped cache keys.
 * - Reads / writes cached values with appropriate TTLs.
 * - Invalidates single keys or entire patterns on data-mutation events.
 * - Provides observability through structured logging.
 */
@Injectable()
export class ReadingEngineCacheService {
  private readonly logger = new Logger(ReadingEngineCacheService.name);

  /** Canonical set of invalidation rules for the entire reading engine. */
  readonly rules: ReadonlyArray<CacheInvalidationRule> = [
    {
      description:
        'Invalidate cached resources when a reading resource is mutated',
      patterns: ['reading:resource:*'],
      triggers: [CacheInvalidationTrigger.RESOURCE_MUTATED],
    },
    {
      description:
        'Invalidate cached token breakdowns when a reading resource is mutated',
      patterns: ['reading:token:*'],
      triggers: [CacheInvalidationTrigger.RESOURCE_MUTATED],
    },
    {
      description:
        'Invalidate flashcard suggestions when user flashcards change',
      patterns: ['reading:suggestion:user:*'],
      triggers: [CacheInvalidationTrigger.FLASHCARD_MUTATED],
    },
    {
      description:
        'Invalidate reading progress cache when user completes a session',
      patterns: ['reading:progress:user:*'],
      triggers: [CacheInvalidationTrigger.READING_COMPLETED],
    },
    {
      description:
        'Invalidate sentence translations cache when a new translation is requested',
      patterns: ['reading:translation:user:*'],
      triggers: [CacheInvalidationTrigger.TRANSLATION_REQUESTED],
    },
    {
      description:
        'Bulk-invalidate every reading-engine key belonging to a user on data clear',
      patterns: [
        'reading:resource:*',
        'reading:token:*',
        'reading:suggestion:user:*',
        'reading:progress:user:*',
        'reading:translation:user:*',
        'reading:session:user:*',
      ],
      triggers: [CacheInvalidationTrigger.USER_DATA_CLEARED],
    },
  ];

  /** Default TTLs (seconds) per namespace -- tuned for LingQ reading patterns. */
  private readonly ttls: Record<ReadingEngineCacheNamespace, number> = {
    [ReadingEngineCacheNamespace.RESOURCE]: 300, // 5 min -- resources change seldom
    [ReadingEngineCacheNamespace.TOKEN]: 600, // 10 min -- tokenisation is stable
    [ReadingEngineCacheNamespace.SUGGESTION]: 120, // 2 min -- suggestions stale quickly
    [ReadingEngineCacheNamespace.PROGRESS]: 60, // 1 min -- progress updates frequently
    [ReadingEngineCacheNamespace.TRANSLATION]: 3600, // 1 hour -- translations are costly
    [ReadingEngineCacheNamespace.SESSION]: 1800, // 30 min -- session metadata
  };

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /* ------------------------------------------------------------------ */
  /*  Public key-builder                                                */
  /* ------------------------------------------------------------------ */

  /**
   * Build a fully-qualified, user-scoped Redis key.
   *
   * Format: `{namespace}:user:{userId}[:{resourceId}][:{extra}]`
   *
   * Examples:
   *   `reading:resource:user:abc123:res-456`
   *   `reading:progress:user:abc123`
   *   `reading:suggestion:user:abc123:fr`
   */
  buildKey(opts: CacheKeyOptions): string {
    const parts: string[] = [opts.namespace, 'user', opts.userId];
    if (opts.resourceId) parts.push(opts.resourceId);
    if (opts.extra) parts.push(opts.extra);
    return parts.join(':');
  }

  /** Build a pattern for scanning all keys of a given namespace for a user. */
  buildUserPattern(
    namespace: ReadingEngineCacheNamespace,
    userId: string,
  ): string {
    return `${namespace}:user:${userId}:*`;
  }

  /* ------------------------------------------------------------------ */
  /*  Public get / set / delete                                         */
  /* ------------------------------------------------------------------ */

  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(
        { key, error: (err as Error).message },
        'Cache read failed',
      );
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const ttl = ttlSeconds ?? this.inferTtl(key);
      await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
      this.logger.debug({ key, ttl }, 'Cache write');
    } catch (err) {
      this.logger.error(
        { key, error: (err as Error).message },
        'Cache write failed',
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      this.logger.debug({ key }, 'Cache key deleted');
    } catch (err) {
      this.logger.error(
        { key, error: (err as Error).message },
        'Cache delete failed',
      );
    }
  }

  /**
   * Delete all keys matching a glob pattern using SCAN + pipeline DEL.
   * Safe for production -- never uses KEYS.
   */
  async deletePattern(pattern: string): Promise<number> {
    let cursor = '0';
    let deleted = 0;
    try {
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          deleted += await this.redis.del(...keys);
        }
      } while (cursor !== '0');
      if (deleted > 0) {
        this.logger.log({ pattern, deleted }, 'Bulk cache invalidation');
      }
    } catch (err) {
      this.logger.error(
        { pattern, error: (err as Error).message },
        'Bulk cache invalidation failed',
      );
    }
    return deleted;
  }

  /* ------------------------------------------------------------------ */
  /*  Event-driven invalidation                                         */
  /* ------------------------------------------------------------------ */

  @OnEvent('reading.resource_mutated')
  async handleResourceMutated(): Promise<void> {
    await this.deletePattern('reading:resource:*');
    await this.deletePattern('reading:token:*');
    this.logger.log('Invalidated resource & token caches (resource_mutated)');
  }

  @OnEvent('reading.flashcard_mutated', { async: true })
  async handleFlashcardMutated(payload: { userId: string }): Promise<void> {
    const pattern = this.buildUserPattern(
      ReadingEngineCacheNamespace.SUGGESTION,
      payload.userId,
    );
    await this.deletePattern(pattern);
    this.logger.log(
      { userId: payload.userId },
      'Invalidated suggestion cache (flashcard_mutated)',
    );
  }

  @OnEvent('reading.reading_completed', { async: true })
  async handleReadingCompleted(payload: { userId: string }): Promise<void> {
    const pattern = this.buildUserPattern(
      ReadingEngineCacheNamespace.PROGRESS,
      payload.userId,
    );
    await this.deletePattern(pattern);
    this.logger.log(
      { userId: payload.userId },
      'Invalidated progress cache (reading_completed)',
    );
  }

  @OnEvent('reading.translation_requested', { async: true })
  async handleTranslationRequested(payload: { userId: string }): Promise<void> {
    const pattern = this.buildUserPattern(
      ReadingEngineCacheNamespace.TRANSLATION,
      payload.userId,
    );
    await this.deletePattern(pattern);
    this.logger.log(
      { userId: payload.userId },
      'Invalidated translation cache (translation_requested)',
    );
  }

  @OnEvent('reading.user_data_cleared', { async: true })
  async handleUserDataCleared(payload: { userId: string }): Promise<void> {
    const prefixes = [
      ReadingEngineCacheNamespace.RESOURCE,
      ReadingEngineCacheNamespace.TOKEN,
      ReadingEngineCacheNamespace.SUGGESTION,
      ReadingEngineCacheNamespace.PROGRESS,
      ReadingEngineCacheNamespace.TRANSLATION,
      ReadingEngineCacheNamespace.SESSION,
    ];
    // ⚡ Bolt Optimization: Replaced sequential await loop with Promise.all to drastically reduce network latency during bulk cache invalidation.
    await Promise.all(
      prefixes.map((ns) =>
        this.deletePattern(this.buildUserPattern(ns, payload.userId)),
      ),
    );
    this.logger.log(
      { userId: payload.userId },
      'Bulk-invalidated all reading-engine caches for user (user_data_cleared)',
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  private inferTtl(key: string): number {
    for (const ns of Object.values(ReadingEngineCacheNamespace)) {
      if (key.startsWith(ns)) return this.ttls[ns];
    }
    return 300; // safe default
  }
}
