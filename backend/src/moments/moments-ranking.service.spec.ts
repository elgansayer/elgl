import { Logger } from '@nestjs/common';
import { MetricsService } from '../metrics/metrics.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MomentRecord } from './interfaces/moment.interface';
import {
  FOR_YOU_CANDIDATE_POOL_LIMIT,
  FOR_YOU_RESULT_LIMIT,
} from './moments-for-you.constants';
import {
  ForYouRankingContext,
  MomentsRankingService,
} from './moments-ranking.service';

const NOW = Date.parse('2026-08-25T12:00:00.000Z');

interface QueryResult {
  data: unknown[] | null;
  error: object | null;
}

function moment(
  id: string,
  userId: string,
  overrides: Partial<MomentRecord> = {},
): MomentRecord {
  return {
    id,
    user_id: userId,
    text_content: '',
    media_type: 'none',
    target_language: 'ja',
    is_pinned: false,
    likes_count: 0,
    comments_count: 0,
    created_at: new Date(NOW - 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

function context(
  followed: string[] = [],
  hashtags: string[] = [],
): ForYouRankingContext {
  return {
    followedAuthorIds: new Set(followed),
    interestedHashtags: new Set(hashtags),
  };
}

/**
 * Builds a Supabase double whose chainable query builders resolve to the
 * configured per-table result, so the ranker's three bounded reads can be
 * exercised without coupling tests to the exact builder call order.
 */
function supabaseFor(tables: Record<string, QueryResult>) {
  const from = vi.fn().mockImplementation((table: string) => {
    const result = tables[table] ?? { data: [], error: null };
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'order', 'limit', 'in']) {
      builder[method] = vi.fn().mockReturnValue(builder);
    }
    builder.then = (resolve: (value: QueryResult) => unknown) =>
      resolve(result);
    return builder;
  });
  const getClient = vi.fn().mockReturnValue({ from });
  return {
    from,
    supabase: { getClient } as unknown as SupabaseService,
    getClient,
  };
}

function metricsDouble() {
  return {
    observeMomentsForYouCandidates: vi.fn(),
    observeMomentsForYouRanking: vi.fn(),
    recordMomentsForYouDegraded: vi.fn(),
  };
}

describe('MomentsRankingService', () => {
  let service: MomentsRankingService;
  let metrics: ReturnType<typeof metricsDouble>;

  function build(supabase: SupabaseService = {} as SupabaseService) {
    return new MomentsRankingService(
      supabase,
      metrics as unknown as MetricsService,
    );
  }

  beforeEach(() => {
    metrics = metricsDouble();
    service = build();
  });

  describe('hashtag extraction', () => {
    it('extracts bounded, normalised Unicode hashtags without duplicates', () => {
      const tags = service.extractHashtags(
        '#Japanese #日本語 #Ｊａｐａｎｅｓｅ #japanese #lang_exchange',
      );

      expect(tags).toEqual(['japanese', '日本語', 'lang_exchange']);
    });

    it.each([
      ['Hindi', '#हिन्दी सीखना', 'हिन्दी'],
      ['Arabic with harakat', '#العَرَبِيَّة اليوم', 'العَرَبِيَّة'],
      ['Hebrew with niqqud', '#עִבְרִית היום', 'עִבְרִית'],
      ['Tamil', '#தமிழ் கற்றல்', 'தமிழ்'],
      ['Bengali', '#বাংলা ভাষা', 'বাংলা'],
      ['Thai', '#ภาษาไทย วันนี้', 'ภาษาไทย'],
    ])(
      'keeps combining marks so %s tags are not truncated',
      (_language, text, expected) => {
        expect(service.extractHashtags(text)).toEqual([expected]);
      },
    );

    it('keeps an interior zero-width non-joiner and drops a trailing one', () => {
      const persian = '#می\u200cخواهم';

      expect(service.extractHashtags(persian)).toEqual([persian.slice(1)]);
      expect(service.extractHashtags('#کتاب\u200c بخوانید')).toEqual(['کتاب']);
    });

    it('does not start a tag with a combining mark or zero-width character', () => {
      expect(service.extractHashtags('#\u0301abc')).toEqual([]);
      expect(service.extractHashtags('#\u200cabc')).toEqual([]);
      expect(service.extractHashtags('no hashtags here #')).toEqual([]);
    });

    it('bounds tag length to 50 characters and 10 tags per Moment', () => {
      const long = `#${'a'.repeat(80)}`;
      const many = Array.from({ length: 15 }, (_, i) => `#tag${i}`).join(' ');

      expect(service.extractHashtags(long)[0]).toHaveLength(50);
      expect(service.extractHashtags(many)).toHaveLength(10);
    });

    it('returns no tags for empty input', () => {
      expect(service.extractHashtags(undefined)).toEqual([]);
      expect(service.extractHashtags(null)).toEqual([]);
      expect(service.extractHashtags('')).toEqual([]);
    });
  });

  describe('scoring', () => {
    it('boosts in-network authors without making raw engagement dominant', () => {
      const publicMoment = moment('public', 'author-public', {
        likes_count: 100,
        comments_count: 20,
      });
      const followedMoment = moment('followed', 'author-followed', {
        likes_count: 5,
        comments_count: 2,
      });

      const ranked = service.rankCandidates(
        [publicMoment, followedMoment],
        context(['author-followed']),
        NOW,
      );

      expect(ranked[0]?.id).toBe('followed');
    });

    it('uses hashtags from viewer history as an explicit relevance signal', () => {
      const generic = moment('generic', 'author-a', {
        text_content: 'Language practice',
      });
      const relevant = moment('relevant', 'author-b', {
        text_content: '今日も #日本語 を勉強しています',
      });

      const ranked = service.rankCandidates(
        [generic, relevant],
        context([], ['日本語']),
        NOW,
      );

      expect(ranked[0]?.id).toBe('relevant');
      expect(ranked[0]?.hashtags).toEqual(['日本語']);
    });

    it('matches viewer interests written in scripts that use combining marks', () => {
      const generic = moment('generic', 'author-a', {
        text_content: 'Language practice',
      });
      const relevant = moment('relevant', 'author-b', {
        text_content: 'आज #हिन्दी सीख रहा हूँ',
      });

      const ranked = service.rankCandidates(
        [generic, relevant],
        context([], ['हिन्दी']),
        NOW,
      );

      expect(ranked[0]?.id).toBe('relevant');
    });

    it('prefers fresher otherwise-equivalent Moments', () => {
      const fresh = moment('fresh', 'author-a', {
        created_at: new Date(NOW - 60 * 60 * 1000).toISOString(),
      });
      const old = moment('old', 'author-b', {
        created_at: new Date(NOW - 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const ranked = service.rankCandidates([old, fresh], context(), NOW);

      expect(ranked.map((item) => item.id)).toEqual(['fresh', 'old']);
    });

    it('applies author diversity after scoring', () => {
      const first = moment('a-1', 'author-a', {
        likes_count: 120,
        comments_count: 40,
      });
      const second = moment('a-2', 'author-a', {
        likes_count: 100,
        comments_count: 30,
      });
      const other = moment('b-1', 'author-b', {
        likes_count: 20,
        comments_count: 5,
      });

      const ranked = service.rankCandidates(
        [first, second, other],
        context(),
        NOW,
      );

      expect(ranked[0]?.id).toBe('a-1');
      expect(ranked[1]?.id).toBe('b-1');
      expect(ranked[2]?.id).toBe('a-2');
    });
  });

  describe('candidate pool and result bounds', () => {
    it('ranks the whole pool so a strong candidate late in retrieval order still wins', () => {
      const weak = Array.from({ length: 79 }, (_, index) =>
        moment(`weak-${index}`, `author-${index}`, {
          created_at: new Date(NOW - 5 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      );
      const strong = moment('strong', 'author-followed');

      const ranked = service.rankCandidates(
        [...weak, strong],
        context(['author-followed']),
        NOW,
      );

      expect(ranked).toHaveLength(FOR_YOU_RESULT_LIMIT);
      expect(ranked[0]?.id).toBe('strong');
    });

    it('never scores more than the candidate pool limit', () => {
      const overflow = moment('beyond-pool', 'author-followed');
      const candidates = [
        ...Array.from({ length: FOR_YOU_CANDIDATE_POOL_LIMIT }, (_, index) =>
          moment(`pooled-${index}`, `author-${index}`, {
            created_at: new Date(NOW - 5 * 24 * 60 * 60 * 1000).toISOString(),
          }),
        ),
        overflow,
      ];

      const ranked = service.rankCandidates(
        candidates,
        context(['author-followed']),
        NOW,
      );

      expect(ranked.map((item) => item.id)).not.toContain('beyond-pool');
    });

    it('returns at most the result limit and keeps the best-scored Moments', () => {
      const candidates = Array.from({ length: 80 }, (_, index) =>
        moment(`moment-${index}`, `author-${index}`, {
          likes_count: index,
          created_at: new Date(NOW - 24 * 60 * 60 * 1000).toISOString(),
        }),
      );

      const ranked = service.rankCandidates(candidates, context(), NOW);
      const rankedIds = new Set(ranked.map((item) => item.id));

      expect(ranked).toHaveLength(FOR_YOU_RESULT_LIMIT);
      expect(rankedIds.has('moment-79')).toBe(true);
      expect(rankedIds.has('moment-0')).toBe(false);
    });

    it('is deterministic for identical inputs', () => {
      const candidates = Array.from({ length: 30 }, (_, index) =>
        moment(`moment-${index}`, `author-${index % 6}`, {
          likes_count: index % 4,
        }),
      );

      const first = service.rankCandidates(candidates, context(), NOW);
      const second = service.rankCandidates(
        [...candidates].reverse(),
        context(),
        NOW,
      );

      expect(second.map((item) => item.id)).toEqual(
        first.map((item) => item.id),
      );
    });
  });

  describe('rankForYou', () => {
    it('fails soft when private ranking context cannot be loaded', async () => {
      const { supabase } = supabaseFor({
        user_follows: { data: null, error: {} },
        moment_likes: { data: null, error: {} },
      });
      const degradedService = build(supabase);

      await expect(
        degradedService.rankForYou('viewer-1', [
          moment('moment-1', 'author-1', { text_content: '#Japanese' }),
        ]),
      ).resolves.toEqual([
        expect.objectContaining({ id: 'moment-1', hashtags: ['japanese'] }),
      ]);
    });

    it('records a degraded outcome and reason without user-specific labels', async () => {
      const { supabase } = supabaseFor({
        user_follows: { data: null, error: {} },
      });

      await build(supabase).rankForYou('viewer-1', [
        moment('moment-1', 'author-1'),
      ]);

      expect(metrics.recordMomentsForYouDegraded).toHaveBeenCalledTimes(1);
      expect(metrics.recordMomentsForYouDegraded).toHaveBeenCalledWith(
        'viewer_context_unavailable',
      );
      expect(metrics.observeMomentsForYouRanking).toHaveBeenCalledWith(
        'degraded',
        expect.any(Number),
      );
    });

    it('ranks followed authors and liked hashtags using viewer context', async () => {
      const { supabase } = supabaseFor({
        user_follows: {
          data: [{ following_id: 'author-followed' }],
          error: null,
        },
        moment_likes: { data: [{ moment_id: 'liked-1' }], error: null },
        moments: {
          data: [{ text_content: 'Loved this #日本語 post' }],
          error: null,
        },
      });
      const contextual = build(supabase);

      const ranked = await contextual.rankForYou('viewer-1', [
        moment('plain', 'author-plain', { likes_count: 10 }),
        moment('tagged', 'author-tagged', { text_content: '#日本語' }),
        moment('followed', 'author-followed'),
      ]);

      expect(ranked.map((item) => item.id)).toEqual([
        'followed',
        'tagged',
        'plain',
      ]);
      expect(metrics.recordMomentsForYouDegraded).not.toHaveBeenCalled();
      expect(metrics.observeMomentsForYouRanking).toHaveBeenCalledWith(
        'ranked',
        expect.any(Number),
      );
    });

    it('fails soft when liked Moment history cannot be loaded', async () => {
      const { supabase } = supabaseFor({
        user_follows: { data: [], error: null },
        moment_likes: { data: [{ moment_id: 'liked-1' }], error: null },
        moments: { data: null, error: {} },
      });

      const ranked = await build(supabase).rankForYou('viewer-1', [
        moment('moment-1', 'author-1'),
      ]);

      expect(ranked.map((item) => item.id)).toEqual(['moment-1']);
      expect(metrics.recordMomentsForYouDegraded).toHaveBeenCalledWith(
        'viewer_context_unavailable',
      );
    });

    it('does not log identifiers, text or provider errors when degrading', async () => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const { supabase } = supabaseFor({
        user_follows: {
          data: null,
          error: { message: 'secret provider text' },
        },
      });

      await build(supabase).rankForYou('viewer-secret-id', [
        moment('moment-1', 'author-1', { text_content: 'private #text' }),
      ]);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith('moments_for_you_context_unavailable');
      const logged = JSON.stringify(warn.mock.calls);
      expect(logged).not.toContain('viewer-secret-id');
      expect(logged).not.toContain('secret provider text');
      expect(logged).not.toContain('private');
      warn.mockRestore();
    });

    it('removes self, duplicate and over-limit candidates before ranking', async () => {
      const { supabase } = supabaseFor({});
      const boundedService = build(supabase);
      const candidates = [
        moment('self', 'viewer-1'),
        moment('duplicate', 'author-1'),
        moment('duplicate', 'author-1'),
        ...Array.from({ length: FOR_YOU_CANDIDATE_POOL_LIMIT + 20 }, (_, i) =>
          moment(`moment-${i}`, `author-${i + 10}`),
        ),
      ];

      const ranked = await boundedService.rankForYou('viewer-1', candidates);

      expect(ranked).toHaveLength(FOR_YOU_RESULT_LIMIT);
      expect(ranked.some((item) => item.user_id === 'viewer-1')).toBe(false);
      expect(ranked.filter((item) => item.id === 'duplicate')).toHaveLength(1);
      expect(metrics.observeMomentsForYouCandidates).toHaveBeenCalledWith(
        'pool',
        FOR_YOU_CANDIDATE_POOL_LIMIT,
      );
      expect(metrics.observeMomentsForYouCandidates).toHaveBeenCalledWith(
        'served',
        FOR_YOU_RESULT_LIMIT,
      );
    });

    it('returns an empty feed without reading viewer context when nothing is eligible', async () => {
      const { supabase, getClient } = supabaseFor({});

      const ranked = await build(supabase).rankForYou('viewer-1', [
        moment('self', 'viewer-1'),
      ]);

      expect(ranked).toEqual([]);
      expect(getClient).not.toHaveBeenCalled();
      expect(metrics.observeMomentsForYouCandidates).toHaveBeenCalledWith(
        'pool',
        0,
      );
      expect(metrics.observeMomentsForYouCandidates).toHaveBeenCalledWith(
        'served',
        0,
      );
      expect(metrics.observeMomentsForYouRanking).toHaveBeenCalledWith(
        'empty',
        expect.any(Number),
      );
    });

    it('reads viewer context with bounded queries and no per-candidate lookups', async () => {
      const { supabase, from } = supabaseFor({
        moment_likes: { data: [{ moment_id: 'liked-1' }], error: null },
        moments: { data: [], error: null },
      });

      await build(supabase).rankForYou(
        'viewer-1',
        Array.from({ length: 40 }, (_, i) => moment(`m-${i}`, `author-${i}`)),
      );

      expect(from.mock.calls.map(([table]) => table).sort()).toEqual([
        'moment_likes',
        'moments',
        'user_follows',
      ]);
    });
  });
});
