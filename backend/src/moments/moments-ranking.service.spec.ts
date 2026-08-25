import { SupabaseService } from '../supabase/supabase.service';
import { MomentRecord } from './interfaces/moment.interface';
import {
  ForYouRankingContext,
  MomentsRankingService,
} from './moments-ranking.service';

const NOW = Date.parse('2026-08-25T12:00:00.000Z');

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

describe('MomentsRankingService', () => {
  let service: MomentsRankingService;

  beforeEach(() => {
    service = new MomentsRankingService({} as SupabaseService);
  });

  it('extracts bounded, normalized Unicode hashtags without duplicates', () => {
    const tags = service.extractHashtags(
      '#Japanese #日本語 #Ｊａｐａｎｅｓｅ #japanese #lang_exchange',
    );

    expect(tags).toEqual(['japanese', '日本語', 'lang_exchange']);
  });

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

    const ranked = service.rankCandidates([first, second, other], context(), NOW);

    expect(ranked[0]?.id).toBe('a-1');
    expect(ranked[1]?.id).toBe('b-1');
    expect(ranked[2]?.id).toBe('a-2');
  });

  it('fails soft when private ranking context cannot be loaded', async () => {
    const failedQuery = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: null, error: {} }),
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: null, error: {} }),
          }),
        }),
      }),
    };
    const supabase = {
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue(failedQuery),
      }),
    };
    const degradedService = new MomentsRankingService(
      supabase as unknown as SupabaseService,
    );

    await expect(
      degradedService.rankForYou('viewer-1', [
        moment('moment-1', 'author-1', { text_content: '#Japanese' }),
      ]),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'moment-1', hashtags: ['japanese'] }),
    ]);
  });

  it('removes self, generated, duplicate and over-limit candidates before ranking', async () => {
    const noHistoryQuery = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    };
    const supabase = {
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue(noHistoryQuery),
      }),
    };
    const boundedService = new MomentsRankingService(
      supabase as unknown as SupabaseService,
    );
    const candidates = [
      moment('self', 'viewer-1'),
      moment('mock-moment-1', 'fake-1'),
      moment('duplicate', 'author-1'),
      moment('duplicate', 'author-1'),
      ...Array.from({ length: 60 }, (_, index) =>
        moment(`moment-${index}`, `author-${index + 10}`),
      ),
    ];

    const ranked = await boundedService.rankForYou('viewer-1', candidates);

    expect(ranked).toHaveLength(50);
    expect(ranked.some((item) => item.user_id === 'viewer-1')).toBe(false);
    expect(ranked.some((item) => item.id.startsWith('mock-moment-'))).toBe(false);
    expect(ranked.filter((item) => item.id === 'duplicate')).toHaveLength(1);
  });
});
