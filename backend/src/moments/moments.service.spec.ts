import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { MomentsService } from './moments.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { TimelineWorker } from './timeline.worker';
import { SafetyService } from '../safety/safety.service';
import { XpService } from '../xp/xp.service';
import { QuestsService } from '../quests/quests.service';
import { R2Service } from '../cloudflare-r2/r2.service';

// Deterministic stand-in for the real mock-data module, which assigns
// languages via Math.random() and made fallback-feed assertions flaky.
vi.mock('../mock-data', () => {
  const langs = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'no'];
  return {
    MOCK_USERS: Array.from({ length: 150 }, (_, i) => {
      const native = langs[i % langs.length];
      const target = langs[(i + 1) % langs.length];
      return {
        id: `fake-${i + 1}`,
        display_name: `User${i + 1}`,
        native_languages: native,
        target_languages: [target],
        bio_text: `Hi! I want to learn ${target.toUpperCase()} and I can teach ${native.toUpperCase()}. Let's chat!`,
        avatar_url: `https://i.pravatar.cc/150?u=fake-${i + 1}`,
        is_vip: false,
        study_streak_days: 0,
        correction_ratio: 0.75,
        is_serious_learner: false,
        created_at: new Date().toISOString(),
      };
    }),
  };
});

describe('MomentsService', () => {
  let service: MomentsService;
  let timelineWorker: TimelineWorker;
  let usersService: UsersService;
  let safetyService: SafetyService;
  let xpService: XpService;
  let questsService: QuestsService;
  let r2Service: R2Service;
  let eventEmitter: EventEmitter2;
  let mockSupabaseClient: any;
  let mockRedisClient: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      returns: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    mockRedisClient = {
      lrange: vi.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        MomentsService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
            getRedisClient: vi.fn().mockReturnValue(mockRedisClient),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getProfile: vi.fn().mockResolvedValue({
              id: 'user-1',
              display_name: 'Serious Learner',
              avatar_url: 'avatar.png',
            }),
          },
        },
        {
          provide: TimelineWorker,
          useValue: {
            fanOutMoment: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: SafetyService,
          useValue: {
            isBlocked: vi.fn().mockResolvedValue(false),
            reportUser: vi.fn().mockResolvedValue(undefined),
            blockUser: vi.fn().mockResolvedValue(undefined),
            unblockUser: vi.fn().mockResolvedValue(undefined),
            getCategories: vi.fn().mockReturnValue(['harassment']),
            getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]),
          },
        },
        {
          provide: XpService,
          useValue: {
            awardXpForActivity: vi.fn(),
          },
        },
        {
          provide: QuestsService,
          useValue: {
            incrementProgress: vi.fn(),
          },
        },
        {
          provide: R2Service,
          useValue: {
            generateUploadUrl: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MomentsService>(MomentsService);
    timelineWorker = module.get<TimelineWorker>(TimelineWorker);
    usersService = module.get<UsersService>(UsersService);
    safetyService = module.get<SafetyService>(SafetyService);
    xpService = module.get<XpService>(XpService);
    questsService = module.get<QuestsService>(QuestsService);
    r2Service = module.get<R2Service>(R2Service);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createMoment', () => {
    it('should throw BadRequestException when media_urls length exceeds 9', async () => {
      const dto: any = {
        media_urls: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
      };

      await expect(service.createMoment('user-1', dto)).rejects.toThrow(
        new BadRequestException(
          'You may upload a maximum of 9 media items per Moment.',
        ),
      );
    });

    it('should insert moment, trigger fan out, and return moment with author details', async () => {
      const dto: any = {
        text_content: 'My practice moment',
        media_urls: ['url1.jpg'],
        media_type: 'image',
        target_language: 'JA',
      };
      const savedMoment: any = {
        id: 'moment-1',
        user_id: 'user-1',
        ...dto,
      };

      mockQueryBuilder.single.mockResolvedValue({
        data: savedMoment,
        error: null,
      });

      const result = await service.createMoment('user-1', dto);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('moments');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        text_content: 'My practice moment',
        media_urls: ['url1.jpg'],
        media_type: 'image',
        target_language: 'JA',
        post_type: 'moment',
        question_text: null,
        question_options: [],
        correct_answer: null,
        voice_note_url: null,
      });
      expect(timelineWorker.fanOutMoment).toHaveBeenCalledWith(
        'moment-1',
        'user-1',
      );
      expect(result.author).toEqual({
        id: 'user-1',
        display_name: 'Serious Learner',
        avatar_url: 'avatar.png',
      });
      expect(result.is_liked_by_me).toBe(false);
    });

    it('should throw Error when moment insert fails', async () => {
      const dto: any = { text_content: 'Test' };
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Insert failure' },
      });

      await expect(service.createMoment('user-1', dto)).rejects.toThrow(
        'Failed to create moment: Insert failure',
      );
    });
  });

  describe('getFeed', () => {
    it('should return following feed from Redis queue when IDs exist', async () => {
      mockRedisClient.lrange.mockResolvedValue(['m-1', 'm-2']);
      const moments = [
        { id: 'm-1', user_id: 'u-1' },
        { id: 'm-2', user_id: 'u-2' },
      ];

      // Setup profile and like hydration mocks when queried
      // In getFeed: first query is `moments` (handled by our check). Then author profiles `in('id', authorIds)`. Then `moment_likes`.
      // Let's make `mockSupabaseClient.from` return different builder behavior depending on table name
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moments') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: moments }),
          };
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 'u-1', display_name: 'User 1' },
                { id: 'u-2', display_name: 'User 2' },
              ],
            }),
          };
        }
        if (table === 'moment_likes') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ moment_id: 'm-1' }],
            }),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.getFeed('user-1', 'Following');

      expect(mockRedisClient.lrange).toHaveBeenCalledWith(
        'timeline_queue:user-1',
        0,
        49,
      );
      expect(result).toHaveLength(2);
      expect(result[0].is_liked_by_me).toBe(true);
      expect(result[1].is_liked_by_me).toBe(false);
    });

    it('should fallback to DB follows query when Redis timeline queue is empty', async () => {
      mockRedisClient.lrange.mockResolvedValue([]);
      const moments = [{ id: 'm-3', user_id: 'u-3' }];

      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'user_follows') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [{ following_id: 'u-3' }] }),
          };
        }
        if (table === 'moments') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: moments }),
          };
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'u-3', display_name: 'User 3' }],
            }),
          };
        }
        if (table === 'moment_likes') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [] }),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.getFeed('user-1', 'Following');
      expect(result.filter((m) => m.id === 'm-3')).toHaveLength(1);
    });

    it('should return classmates feed filtered by target language', async () => {
      const moments = [{ id: 'm-4', user_id: 'u-4' }];
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: moments }),
          };
        }
        if (table === 'users' || table === 'moment_likes') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            then: (resolve: any) => resolve({ data: [] }),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.getFeed('user-1', 'Classmates', 'fr');
      expect(result).toHaveLength(1);
    });

    it("should only show moments targeted at the viewer's native language (or untargeted) for the All filter", async () => {
      vi.spyOn(usersService, 'getProfile').mockResolvedValue({
        id: 'user-1',
        display_name: 'Serious Learner',
        avatar_url: 'avatar.png',
        native_languages: ['fr'],
      } as any);

      const moments = [
        { id: 'm-fr', user_id: 'u-1', target_language: 'fr' },
        { id: 'm-de', user_id: 'u-2', target_language: 'de' },
        { id: 'm-none', user_id: 'u-3', target_language: null },
      ];

      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moments') {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: moments }),
          };
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 'u-1', display_name: 'User 1' },
                { id: 'u-2', display_name: 'User 2' },
                { id: 'u-3', display_name: 'User 3' },
              ],
            }),
          };
        }
        if (table === 'moment_likes') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [] }),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.getFeed('user-1', 'All');

      expect(result.map((m) => m.id).sort()).toEqual(['m-fr', 'm-none']);
    });

    it('should match target_language to native_languages case-insensitively', async () => {
      vi.spyOn(usersService, 'getProfile').mockResolvedValue({
        id: 'user-1',
        display_name: 'Serious Learner',
        avatar_url: 'avatar.png',
        native_languages: ['ja'],
      } as any);

      const moments = [{ id: 'm-ja', user_id: 'u-1', target_language: 'JA' }];

      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moments') {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: moments }),
          };
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'u-1', display_name: 'User 1' }],
            }),
          };
        }
        if (table === 'moment_likes') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [] }),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.getFeed('user-1', 'All');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('m-ja');
    });

    it('should return generated mock moments when DB returns no moments', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moments') {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [] }),
          };
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [] }),
          };
        }
        if (table === 'moment_likes') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [] }),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.getFeed('user-1', 'All');
      // The service generates fallback mock moments when the DB returns nothing.
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].id).toMatch(/^mock-moment-/);
    });
  });

  describe('likeMoment', () => {
    it('should delete existing like and decrement likes_count when already liked', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moment_likes') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'like-1', moment_id: 'm-1' },
            }),
            delete: vi.fn().mockReturnThis(),
          };
        }
        if (table === 'moments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { likes_count: 5 } }),
            update: vi.fn().mockReturnThis(),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.likeMoment('user-1', 'm-1');
      expect(result).toEqual({ likes_count: 4, is_liked: false });
    });

    it('should insert new like and increment likes_count when not liked yet', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moment_likes') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null }),
            insert: vi.fn().mockResolvedValue({}),
          };
        }
        if (table === 'moments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { likes_count: 2 } }),
            update: vi.fn().mockReturnThis(),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.likeMoment('user-1', 'm-1');
      expect(result).toEqual({ likes_count: 3, is_liked: true });
    });
  });

  describe('addComment and getComments', () => {
    it('should add comment, increment comments_count, and return comment with author', async () => {
      const dto = { text_content: 'Great moment!' };
      const commentRow = {
        id: 'c-1',
        moment_id: 'm-1',
        user_id: 'user-1',
        ...dto,
      };

      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moment_comments') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: commentRow, error: null }),
          };
        }
        if (table === 'moments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { comments_count: 3 } }),
            update: vi.fn().mockReturnThis(),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.addComment('user-1', 'm-1', dto);
      expect(result.id).toBe('c-1');
      expect(result.author?.display_name).toBe('Serious Learner');
    });

    it('should return comments list with populated authors', async () => {
      const comments = [{ id: 'c-1', user_id: 'u-1', text_content: 'Hi' }];
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moment_comments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: comments }),
          };
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'u-1', display_name: 'Commenter' }],
            }),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.getComments('m-1');
      expect(result).toHaveLength(1);
      expect(result[0].author?.display_name).toBe('Commenter');
    });
  });

  describe('pinMoment', () => {
    it('should throw ForbiddenException if user is not VIP (with dual currency message)', async () => {
      await expect(service.pinMoment('user-1', false, 'm-1')).rejects.toThrow(
        new ForbiddenException(
          'Moment pinning is exclusively available to VIP subscribers (8 UKP / $10 USD per month). Upgrade now to pin highlights to the top of the feed!',
        ),
      );
    });

    it('should throw ForbiddenException if moment not found or not owned by user', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation(() => {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { user_id: 'other-user', is_pinned: false },
          }),
        };
      });

      await expect(service.pinMoment('user-1', true, 'm-1')).rejects.toThrow(
        new ForbiddenException('You can only pin your own Moments.'),
      );
    });

    it('should toggle is_pinned successfully for author who is VIP', async () => {
      let callCount = 0;
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moments') {
          callCount++;
          if (callCount === 1) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { user_id: 'user-1', is_pinned: false },
              }),
            };
          } else {
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: 'm-1', user_id: 'user-1', is_pinned: true },
                error: null,
              }),
            };
          }
        }
        return mockQueryBuilder;
      });

      const result = await service.pinMoment('user-1', true, 'm-1');
      expect(result.is_pinned).toBe(true);
    });

    it('should throw ForbiddenException when the moment does not exist', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
      }));

      await expect(
        service.pinMoment('user-1', true, 'missing-moment'),
      ).rejects.toThrow(new ForbiddenException('Moment not found.'));
    });

    it('should throw when toggling the pin fails to persist', async () => {
      let callCount = 0;
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table !== 'moments') return mockQueryBuilder;
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { user_id: 'user-1', is_pinned: false },
            }),
          };
        }
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'persist failed' },
          }),
        };
      });

      await expect(service.pinMoment('user-1', true, 'm-1')).rejects.toThrow(
        'Failed to toggle pin: persist failed',
      );
    });
  });

  describe('getLifetimeCounts', () => {
    it('should aggregate moments, corrections and translations counts', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moments') {
          return {
            select: vi
              .fn()
              .mockResolvedValue({ data: [{ id: '1' }, { id: '2' }] }),
          };
        }
        if (table === 'moment_comments') {
          return {
            select: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({ data: [{ id: 'c-1' }] }),
            }),
          };
        }
        if (table === 'translations') {
          return {
            select: vi.fn().mockResolvedValue({ data: [{ id: 't-1' }] }),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.getLifetimeCounts('user-1');

      expect(result).toEqual({ translations: 1, corrections: 1, moments: 2 });
    });

    it('should throw when any of the count queries error', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moments') {
          return {
            select: vi
              .fn()
              .mockResolvedValue({ data: null, error: { message: 'boom' } }),
          };
        }
        if (table === 'moment_comments') {
          return {
            select: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({ data: [] }),
            }),
          };
        }
        if (table === 'translations') {
          return { select: vi.fn().mockResolvedValue({ data: [] }) };
        }
        return mockQueryBuilder;
      });

      await expect(service.getLifetimeCounts('user-1')).rejects.toThrow(
        /Failed to fetch counts/,
      );
    });
  });

  describe('getUserLearningCounts', () => {
    it('scopes moments and corrections to the requested learner', async () => {
      const momentsEq = vi.fn().mockResolvedValue({
        data: [{ id: 'moment-1' }],
        error: null,
      });
      const correctionsNot = vi.fn().mockResolvedValue({
        data: [{ id: 'correction-1' }, { id: 'correction-2' }],
        error: null,
      });
      const correctionsEq = vi.fn().mockReturnValue({
        not: correctionsNot,
      });

      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moments') {
          return {
            select: vi.fn().mockReturnValue({ eq: momentsEq }),
          };
        }
        if (table === 'moment_comments') {
          return {
            select: vi.fn().mockReturnValue({ eq: correctionsEq }),
          };
        }
        return mockQueryBuilder;
      });

      await expect(service.getUserLearningCounts('user-1')).resolves.toEqual({
        corrections: 2,
        moments: 1,
      });
      expect(momentsEq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(correctionsEq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(correctionsNot).toHaveBeenCalledWith(
        'correction_payload',
        'is',
        null,
      );
    });
  });

  describe('createStory', () => {
    it('should default expiry to 24 hours and return the story with author details', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: {
          id: 'story-1',
          user_id: 'user-1',
          text_content: 'Hello',
          media_urls: [],
          media_type: 'none',
          voice_note_url: null,
          target_language: null,
          expires_at: '2026-08-02T00:00:00.000Z',
          created_at: '2026-08-01T00:00:00.000Z',
        },
        error: null,
      });

      const result = await service.createStory('user-1', {
        text_content: 'Hello',
      });

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-1', is_ephemeral: true }),
      );
      expect(result.id).toBe('story-1');
      expect(result.author).toEqual({
        id: 'user-1',
        display_name: 'Serious Learner',
        avatar_url: 'avatar.png',
      });
    });

    it('should throw when the story insert fails', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'insert failed' },
      });

      await expect(
        service.createStory('user-1', { text_content: 'Hello' }),
      ).rejects.toThrow('Failed to create story: insert failed');
    });
  });

  describe('createLanguageQuestion', () => {
    const dto = {
      target_language: 'ja',
      question_text: 'What does this mean?',
      question_options: ['A', 'B'],
      correct_answer: 'A',
    };

    it('should create the question, award xp/quest progress, and hydrate the author', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: 'q-1', user_id: 'user-1', ...dto },
        error: null,
      });

      const result = await service.createLanguageQuestion('user-1', dto);

      expect(xpService.awardXpForActivity).toHaveBeenCalledWith(
        'user-1',
        'create_moment',
      );
      expect(questsService.incrementProgress).toHaveBeenCalledWith(
        'user-1',
        'post_moment',
        1,
      );
      expect(result.author?.display_name).toBe('Serious Learner');
      expect(result.is_liked_by_me).toBe(false);
    });

    it('should throw when the insert fails', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'db error' },
      });

      await expect(
        service.createLanguageQuestion('user-1', dto),
      ).rejects.toThrow('Failed to create language question: db error');
    });
  });

  describe('getFeed additional targeted visibility and safety cases', () => {
    it('should exclude moments from blocked or blocking users', async () => {
      vi.spyOn(safetyService, 'getBlockedAndBlockerIds').mockResolvedValue([
        'u-blocked',
      ]);

      const moments = [
        { id: 'm-1', user_id: 'u-1', target_language: null },
        { id: 'm-2', user_id: 'u-blocked', target_language: null },
      ];

      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moments') {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: moments }),
          };
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'u-1', display_name: 'User 1' }],
            }),
          };
        }
        if (table === 'moment_likes') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [] }),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.getFeed('user-1', 'All');
      expect(result.map((m) => m.id)).toEqual(['m-1']);
    });

    it('should not apply targeted visibility filtering to the Classmates feed', async () => {
      vi.spyOn(usersService, 'getProfile').mockResolvedValue({
        id: 'user-1',
        display_name: 'Serious Learner',
        avatar_url: 'avatar.png',
        native_languages: ['fr'],
      } as any);

      const moments = [{ id: 'm-de', user_id: 'u-2', target_language: 'de' }];

      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: moments }),
          };
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'u-2', display_name: 'User 2' }],
            }),
          };
        }
        if (table === 'moment_likes') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [] }),
          };
        }
        return mockQueryBuilder;
      });

      // Native language is 'fr' but the Classmates room is 'de': the post must
      // still be shown because targeted visibility is scoped to All/Following only.
      const result = await service.getFeed('user-1', 'Classmates', 'de');
      expect(result.map((m) => m.id)).toEqual(['m-de']);
    });

    it('should filter generated mock moments by targetLang for the Classmates fallback', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [] }),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.getFeed('user-1', 'Classmates', 'fr');
      expect(result.length).toBeGreaterThan(0);
      result.forEach((m) => expect(m.target_language.toLowerCase()).toBe('fr'));
    });

    it('should filter generated mock moments by native language for the All/Following fallback', async () => {
      vi.spyOn(usersService, 'getProfile').mockResolvedValue({
        id: 'user-1',
        display_name: 'Serious Learner',
        avatar_url: 'avatar.png',
        native_languages: ['ja'],
      } as any);

      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moments') {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [] }),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.getFeed('user-1', 'All');
      result.forEach((m) =>
        expect(
          !m.target_language || m.target_language.toLowerCase() === 'ja',
        ).toBe(true),
      );
    });
  });

  describe('getQuestions', () => {
    const buildQuery = (data: any) => {
      const query: any = { data, error: null };
      query.select = vi.fn().mockReturnValue(query);
      query.in = vi.fn().mockReturnValue(query);
      query.eq = vi.fn().mockReturnValue(query);
      query.order = vi.fn().mockReturnValue(query);
      query.limit = vi.fn().mockReturnValue(query);
      return query;
    };

    it('should return questions filtered by target language with hydrated authors', async () => {
      const questions = [{ id: 'q-1', user_id: 'u-1' }];
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moments') return buildQuery(questions);
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'u-1', display_name: 'User 1' }],
            }),
          };
        }
        if (table === 'moment_likes') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [] }),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.getQuestions('user-1', 'ja');
      expect(result).toHaveLength(1);
      expect(result[0].author?.display_name).toBe('User 1');
    });

    it('should exclude questions from blocked users', async () => {
      vi.spyOn(safetyService, 'getBlockedAndBlockerIds').mockResolvedValue([
        'u-blocked',
      ]);
      const questions = [
        { id: 'q-1', user_id: 'u-1' },
        { id: 'q-2', user_id: 'u-blocked' },
      ];
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moments') return buildQuery(questions);
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'u-1', display_name: 'User 1' }],
            }),
          };
        }
        if (table === 'moment_likes') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [] }),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.getQuestions('user-1');
      expect(result.map((m) => m.id)).toEqual(['q-1']);
    });

    it('should throw when the questions query errors', async () => {
      const query = buildQuery(null);
      query.error = { message: 'query failed' };
      mockSupabaseClient.from = vi.fn().mockReturnValue(query);

      await expect(service.getQuestions('user-1')).rejects.toThrow(
        'Failed to fetch questions: query failed',
      );
    });

    it('should return generated mock questions when there is no data', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moments') return buildQuery([]);
        return mockQueryBuilder;
      });

      const result = await service.getQuestions('user-1');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].id).toMatch(/^mock-question-/);
    });
  });

  describe('answerLanguageQuestion', () => {
    it('should throw when the moment cannot be found', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      await expect(
        service.answerLanguageQuestion('user-1', 'm-1', 'A'),
      ).rejects.toThrow('Moment not found');
    });

    it('should throw BadRequestException for a moment that is not a language question', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: { post_type: 'moment' }, error: null }),
      }));

      await expect(
        service.answerLanguageQuestion('user-1', 'm-1', 'A'),
      ).rejects.toThrow(
        new BadRequestException('Only language questions can be answered.'),
      );
    });

    it('should record the answer and report whether it was correct', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                user_id: 'author-1',
                post_type: 'language_question',
                correct_answer: 'A',
                question_options: ['A', 'B'],
                question_text: 'Q?',
              },
              error: null,
            }),
          };
        }
        if (table === 'moment_question_answers') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            returns: vi.fn().mockResolvedValue({
              data: [{ is_correct: true }, { is_correct: false }],
              error: null,
            }),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.answerLanguageQuestion('user-1', 'm-1', 'A');
      expect(result).toEqual({ correct: true, correctAnswer: 'A' });
    });

    it('should report an incorrect answer', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                user_id: 'author-1',
                post_type: 'language_question',
                correct_answer: 'A',
              },
              error: null,
            }),
          };
        }
        if (table === 'moment_question_answers') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            returns: vi
              .fn()
              .mockResolvedValue({ data: [{ is_correct: false }] }),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.answerLanguageQuestion('user-1', 'm-1', 'B');
      expect(result).toEqual({ correct: false, correctAnswer: 'A' });
    });
  });

  describe('likeMoment blocking', () => {
    it('should throw when the moment author has blocked the current user', async () => {
      vi.spyOn(safetyService, 'getBlockedAndBlockerIds').mockResolvedValue([
        'user-1',
      ]);
      mockSupabaseClient.from = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: { user_id: 'author-1' }, error: null }),
      }));

      await expect(service.likeMoment('user-1', 'm-1')).rejects.toThrow(
        'You cannot interact with this moment.',
      );
    });
  });

  describe('getMomentLikes', () => {
    it('should return the users who liked a moment', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        returns: vi.fn().mockResolvedValue({
          data: [
            {
              users: {
                id: 'u-1',
                display_name: 'User 1',
                avatar_url: null,
                target_languages: ['fr'],
              },
            },
            {
              users: {
                id: 'u-2',
                display_name: 'User 2',
                avatar_url: null,
                target_languages: ['de'],
              },
            },
          ],
        }),
      }));

      const result = await service.getMomentLikes('m-1', 'user-1');
      expect(result.map((u) => u.id)).toEqual(['u-1', 'u-2']);
    });

    it('should exclude blocked users from the likes list', async () => {
      vi.spyOn(safetyService, 'getBlockedAndBlockerIds').mockResolvedValue([
        'u-2',
      ]);
      mockSupabaseClient.from = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        returns: vi.fn().mockResolvedValue({
          data: [
            { users: { id: 'u-1', display_name: 'User 1' } },
            { users: { id: 'u-2', display_name: 'User 2' } },
          ],
        }),
      }));

      const result = await service.getMomentLikes('m-1', 'user-1');
      expect(result.map((u) => u.id)).toEqual(['u-1']);
    });

    it('should throw when fetching likes fails', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        returns: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'boom' },
        }),
      }));

      await expect(service.getMomentLikes('m-1')).rejects.toThrow(
        'Failed to fetch likes: boom',
      );
    });
  });

  describe('addComment safety, notifications and mentions', () => {
    it('should throw when the moment author has blocked the commenter', async () => {
      vi.spyOn(safetyService, 'getBlockedAndBlockerIds').mockResolvedValue([
        'commenter-1',
      ]);
      mockSupabaseClient.from = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: { user_id: 'author-1' }, error: null }),
      }));

      await expect(
        service.addComment('commenter-1', 'm-1', { text_content: 'Hi' }),
      ).rejects.toThrow('You cannot comment on this moment.');
    });

    it('should throw when the comment insert fails', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: { user_id: 'author-1' } }),
          };
        }
        if (table === 'moment_comments') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: null, error: { message: 'nope' } }),
          };
        }
        return mockQueryBuilder;
      });

      await expect(
        service.addComment('commenter-1', 'm-1', { text_content: 'Hi' }),
      ).rejects.toThrow('Failed to add comment: nope');
    });

    it('should notify the moment author and any @mentioned users', async () => {
      const emitSpy = vi.spyOn(eventEmitter, 'emit');
      const commentRow = {
        id: 'c-1',
        moment_id: 'm-1',
        user_id: 'commenter-1',
        text_content: 'Nice work @bob',
      };

      const sharedMomentsTable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValueOnce({ data: { user_id: 'author-1' } })
          .mockResolvedValueOnce({
            data: { comments_count: 3, user_id: 'author-1' },
          }),
      };

      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moment_comments') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: commentRow, error: null }),
          };
        }
        if (table === 'moments') {
          return sharedMomentsTable;
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'bob-id', display_name: 'bob' }],
            }),
          };
        }
        return mockQueryBuilder;
      });

      await service.addComment('commenter-1', 'm-1', {
        text_content: 'Nice work @bob',
      });

      expect(emitSpy).toHaveBeenCalledWith(
        'moment.comment',
        expect.objectContaining({ momentAuthorId: 'author-1' }),
      );
      expect(emitSpy).toHaveBeenCalledWith(
        'moment.mention',
        expect.objectContaining({
          momentAuthorId: 'author-1',
          mentionedUserIds: ['bob-id'],
        }),
      );
    });

    it('should award quest progress when the comment contains a correction payload', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moment_comments') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'c-1', moment_id: 'm-1', user_id: 'commenter-1' },
              error: null,
            }),
          };
        }
        if (table === 'moments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: { user_id: 'author-1' } }),
          };
        }
        return mockQueryBuilder;
      });

      await service.addComment('commenter-1', 'm-1', {
        correction_payload: { original: 'foo', corrected: 'bar' },
      });

      expect(questsService.incrementProgress).toHaveBeenCalledWith(
        'commenter-1',
        'correct_moments',
        1,
      );
    });
  });

  describe('getComments votes and blocking', () => {
    it('should exclude comments from blocked users and populate vote tallies', async () => {
      vi.spyOn(safetyService, 'getBlockedAndBlockerIds').mockResolvedValue([
        'u-blocked',
      ]);

      const comments = [
        { id: 'c-1', user_id: 'u-1', text_content: 'Hi' },
        { id: 'c-2', user_id: 'u-blocked', text_content: 'Bad' },
      ];

      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moment_comments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: comments }),
          };
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'u-1', display_name: 'Commenter' }],
            }),
          };
        }
        if (table === 'moment_comment_votes') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                { comment_id: 'c-1', user_id: 'user-1', vote: 'up' },
                { comment_id: 'c-1', user_id: 'u-2', vote: 'down' },
              ],
            }),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.getComments('m-1', 'user-1');
      expect(result).toHaveLength(1);
      expect(result[0].upVotes).toBe(1);
      expect(result[0].downVotes).toBe(1);
      expect(result[0].userVote).toBe('up');
    });

    it('should return an empty array when there are no comments', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [] }),
      }));

      const result = await service.getComments('m-1');
      expect(result).toEqual([]);
    });
  });

  describe('getVoiceUploadUrl and getMediaUploadUrl', () => {
    it('should throw ForbiddenException with the dual-currency message for non-VIP users', async () => {
      vi.spyOn(usersService, 'getProfile').mockResolvedValue({
        id: 'user-1',
        is_vip: false,
      } as any);

      await expect(
        service.getVoiceUploadUrl('user-1', 'note.mp3', 'audio/mpeg'),
      ).rejects.toThrow(
        new ForbiddenException(
          'Voice notes are only available for VIP subscribers (8 UKP / $10 USD per month).',
        ),
      );
    });

    it('should return an upload URL for VIP users', async () => {
      vi.spyOn(usersService, 'getProfile').mockResolvedValue({
        id: 'user-1',
        is_vip: true,
      } as any);
      vi.spyOn(r2Service, 'generateUploadUrl').mockResolvedValue({
        uploadUrl: 'upload-url',
        publicUrl: 'public-url',
      });

      const result = await service.getVoiceUploadUrl(
        'user-1',
        'note.mp3',
        'audio/mpeg',
      );
      expect(result).toEqual({
        uploadUrl: 'upload-url',
        publicUrl: 'public-url',
      });
    });

    it('should return a media upload URL without a VIP check', async () => {
      vi.spyOn(r2Service, 'generateUploadUrl').mockResolvedValue({
        uploadUrl: 'upload-url',
        publicUrl: 'public-url',
      });

      const result = await service.getMediaUploadUrl('photo.jpg', 'image/jpeg');
      expect(result.uploadUrl).toBe('upload-url');
    });
  });

  describe('editMomentText', () => {
    it('should throw when the moment cannot be found', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      await expect(
        service.editMomentText('user-1', 'm-1', { textContent: 'New text' }),
      ).rejects.toThrow('Moment not found');
    });

    it('should throw when the editor is blocked by the moment author', async () => {
      vi.spyOn(safetyService, 'getBlockedAndBlockerIds').mockResolvedValue([
        'user-1',
      ]);
      mockSupabaseClient.from = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: 'author-1', text_content: 'old' },
          error: null,
        }),
      }));

      await expect(
        service.editMomentText('user-1', 'm-1', { textContent: 'New text' }),
      ).rejects.toThrow('You cannot edit this moment.');
    });

    it('should update the text and return the hydrated moment', async () => {
      const sharedMomentsTable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValueOnce({
            data: { user_id: 'user-1', text_content: 'old' },
            error: null,
          })
          .mockResolvedValueOnce({
            data: {
              id: 'm-1',
              user_id: 'user-1',
              text_content: 'New text',
              is_pinned: false,
              likes_count: 0,
              comments_count: 0,
              media_type: 'none',
              target_language: 'en',
              created_at: '2026-08-01T00:00:00.000Z',
            },
            error: null,
          }),
      };
      mockSupabaseClient.from = vi.fn().mockReturnValue(sharedMomentsTable);

      const result = await service.editMomentText('user-1', 'm-1', {
        textContent: 'New text',
      });

      expect(result.text_content).toBe('New text');
      expect(result.author?.display_name).toBe('Serious Learner');
      expect(result.is_liked_by_me).toBe(false);
    });

    it('should throw when the update fails', async () => {
      let callCount = 0;
      mockSupabaseClient.from = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { user_id: 'user-1', text_content: 'old' },
              error: null,
            }),
          };
        }
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi
            .fn()
            .mockResolvedValue({ error: { message: 'update failed' } }),
        };
      });

      await expect(
        service.editMomentText('user-1', 'm-1', { textContent: 'New text' }),
      ).rejects.toThrow('Failed to edit moment text: update failed');
    });

    it('should throw when the updated moment cannot be retrieved', async () => {
      const sharedMomentsTable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValueOnce({
            data: { user_id: 'user-1', text_content: 'old' },
            error: null,
          })
          .mockResolvedValueOnce({ data: null, error: { message: 'gone' } }),
      };
      mockSupabaseClient.from = vi.fn().mockReturnValue(sharedMomentsTable);

      await expect(
        service.editMomentText('user-1', 'm-1', { textContent: 'New text' }),
      ).rejects.toThrow('Failed to retrieve updated moment');
    });
  });

  describe('voteOnCorrection', () => {
    it('should throw when the comment cannot be found', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      await expect(
        service.voteOnCorrection('user-1', 'c-1', 'up'),
      ).rejects.toThrow('Comment not found');
    });

    it('should insert a new vote when the user has not voted yet', async () => {
      let voteCalls = 0;
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moment_comments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'c-1', user_id: 'author-1' },
            }),
          };
        }
        if (table === 'moment_comment_votes') {
          voteCalls++;
          if (voteCalls === 1) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: null }),
            };
          }
          if (voteCalls === 2) {
            return { insert: vi.fn().mockResolvedValue({ error: null }) };
          }
          if (voteCalls === 3) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ data: [{ vote: 'up' }] }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { vote: 'up' } }),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.voteOnCorrection('user-1', 'c-1', 'up');
      expect(result).toEqual({
        commentId: 'c-1',
        vote: 'up',
        upVotes: 1,
        downVotes: 0,
        userVote: 'up',
      });
    });

    it('should remove the vote when the same vote is cast again (toggle off)', async () => {
      let voteCalls = 0;
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moment_comments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'c-1', user_id: 'author-1' },
            }),
          };
        }
        if (table === 'moment_comment_votes') {
          voteCalls++;
          if (voteCalls === 1) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi
                .fn()
                .mockResolvedValue({ data: { id: 'vote-1', vote: 'up' } }),
            };
          }
          if (voteCalls === 2) {
            return {
              delete: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
            };
          }
          if (voteCalls === 3) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ data: [] }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null }),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.voteOnCorrection('user-1', 'c-1', 'up');
      expect(result).toEqual({
        commentId: 'c-1',
        vote: '',
        upVotes: 0,
        downVotes: 0,
        userVote: null,
      });
    });

    it('should switch the vote when the opposite vote is cast', async () => {
      let voteCalls = 0;
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'moment_comments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'c-1', user_id: 'author-1' },
            }),
          };
        }
        if (table === 'moment_comment_votes') {
          voteCalls++;
          if (voteCalls === 1) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi
                .fn()
                .mockResolvedValue({ data: { id: 'vote-1', vote: 'down' } }),
            };
          }
          if (voteCalls === 2) {
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
            };
          }
          if (voteCalls === 3) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ data: [{ vote: 'up' }] }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { vote: 'up' } }),
          };
        }
        return mockQueryBuilder;
      });

      const result = await service.voteOnCorrection('user-1', 'c-1', 'up');
      expect(result).toEqual({
        commentId: 'c-1',
        vote: 'up',
        upVotes: 1,
        downVotes: 0,
        userVote: 'up',
      });
    });
  });
});
