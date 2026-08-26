import { ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MomentRecord } from './interfaces/moment.interface';
import { MomentsFeedService } from './moments-feed.service';
import { MomentsService } from './moments.service';

function moment(
  id: string,
  userId: string,
  overrides: Partial<MomentRecord> = {},
): MomentRecord {
  return {
    id,
    user_id: userId,
    media_type: 'none',
    target_language: 'ja',
    is_pinned: false,
    likes_count: 0,
    comments_count: 0,
    created_at: '2026-08-25T00:00:00.000Z',
    ...overrides,
  };
}

describe('MomentsFeedService', () => {
  let service: MomentsFeedService;
  let momentsService: { getFeed: ReturnType<typeof vi.fn> };
  let followsEq: ReturnType<typeof vi.fn>;
  let followsSelect: ReturnType<typeof vi.fn>;
  let from: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    momentsService = {
      getFeed: vi.fn().mockResolvedValue([]),
    };
    followsEq = vi.fn().mockResolvedValue({ data: [], error: null });
    followsSelect = vi.fn().mockReturnValue({ eq: followsEq });
    from = vi.fn().mockReturnValue({ select: followsSelect });

    service = new MomentsFeedService(
      momentsService as unknown as MomentsService,
      {
        getClient: vi.fn().mockReturnValue({ from }),
      } as unknown as SupabaseService,
    );
  });

  it('removes synthetic, ephemeral, non-Moment and duplicate rows and caps responses at 50', async () => {
    const valid = Array.from({ length: 55 }, (_, index) =>
      moment(`moment-${index}`, `author-${index}`),
    );
    momentsService.getFeed.mockResolvedValue([
      moment('mock-moment-1', 'fake-author'),
      moment('story-1', 'author-story', { is_ephemeral: true }),
      moment('question-1', 'author-question', { post_type: 'question' }),
      valid[0],
      ...valid,
    ]);

    const result = await service.getFeed('viewer-1', 'All');

    expect(result).toHaveLength(50);
    expect(result[0]?.id).toBe('moment-0');
    expect(new Set(result.map((item) => item.id)).size).toBe(50);
    expect(result.some((item) => item.id.startsWith('mock-moment-'))).toBe(false);
  });

  it('enforces Classmates membership against the normalised target language', async () => {
    momentsService.getFeed.mockResolvedValue([
      moment('ja-1', 'author-1', { target_language: 'JA' }),
      moment('fr-1', 'author-2', { target_language: 'fr' }),
    ]);

    const result = await service.getFeed('viewer-1', 'Classmates', ' ja ');

    expect(momentsService.getFeed).toHaveBeenCalledWith(
      'viewer-1',
      'Classmates',
      'ja',
    );
    expect(result.map((item) => item.id)).toEqual(['ja-1']);
  });

  it('returns no Classmates rows when no target language can be resolved', async () => {
    const result = await service.getFeed('viewer-1', 'Classmates');

    expect(result).toEqual([]);
    expect(momentsService.getFeed).not.toHaveBeenCalled();
  });

  it('re-validates Following rows against the current follow graph', async () => {
    momentsService.getFeed.mockResolvedValue([
      moment('self', 'viewer-1'),
      moment('still-followed', 'author-1'),
      moment('stale-queue-row', 'author-2'),
    ]);
    followsEq.mockResolvedValue({
      data: [{ following_id: 'author-1' }],
      error: null,
    });

    const result = await service.getFeed('viewer-1', 'Following');

    expect(from).toHaveBeenCalledWith('user_follows');
    expect(followsSelect).toHaveBeenCalledWith('following_id');
    expect(followsEq).toHaveBeenCalledWith('follower_id', 'viewer-1');
    expect(result.map((item) => item.id)).toEqual(['still-followed']);
  });

  it('fails closed when Following membership cannot be verified', async () => {
    momentsService.getFeed.mockResolvedValue([
      moment('possibly-followed', 'author-1'),
    ]);
    followsEq.mockResolvedValue({
      data: null,
      error: { message: 'provider details must not escape' },
    });

    await expect(service.getFeed('viewer-1', 'Following')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('does not perform follow-graph reads for All or Classmates', async () => {
    momentsService.getFeed.mockResolvedValue([
      moment('moment-1', 'author-1'),
    ]);

    await service.getFeed('viewer-1', 'All');
    await service.getFeed('viewer-1', 'Classmates', 'ja');

    expect(from).not.toHaveBeenCalled();
  });
});
