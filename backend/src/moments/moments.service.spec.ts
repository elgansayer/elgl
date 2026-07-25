import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MomentsService } from './moments.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { TimelineWorker } from './timeline.worker';
import { SafetyService } from '../safety/safety.service';

describe('MomentsService', () => {
  let service: MomentsService;
  let timelineWorker: TimelineWorker;
  let mockSupabaseClient: any;
  let mockRedisClient: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    mockRedisClient = {
      lrange: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        MomentsService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
            getRedisClient: jest.fn().mockReturnValue(mockRedisClient),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getProfile: jest.fn().mockResolvedValue({
              id: 'user-1',
              display_name: 'Serious Learner',
              avatar_url: 'avatar.png',
            }),
          },
        },
        {
          provide: TimelineWorker,
          useValue: {
            fanOutMoment: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: SafetyService,
          useValue: {
            isBlocked: jest.fn().mockResolvedValue(false),
            reportUser: jest.fn().mockResolvedValue(undefined),
            blockUser: jest.fn().mockResolvedValue(undefined),
            unblockUser: jest.fn().mockResolvedValue(undefined),
            getCategories: jest.fn().mockReturnValue(['harassment']),
            getBlockedAndBlockerIds: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<MomentsService>(MomentsService);
    timelineWorker = module.get<TimelineWorker>(TimelineWorker);
  });

  afterEach(() => {
    jest.clearAllMocks();
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
      mockSupabaseClient.from = jest
        .fn()
        .mockImplementation((table: string) => {
          if (table === 'moments') {
            return {
              select: jest.fn().mockReturnThis(),
              in: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({ data: moments }),
            };
          }
          if (table === 'users') {
            return {
              select: jest.fn().mockReturnThis(),
              in: jest.fn().mockResolvedValue({
                data: [
                  { id: 'u-1', display_name: 'User 1' },
                  { id: 'u-2', display_name: 'User 2' },
                ],
              }),
            };
          }
          if (table === 'moment_likes') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              in: jest.fn().mockResolvedValue({
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

      mockSupabaseClient.from = jest
        .fn()
        .mockImplementation((table: string) => {
          if (table === 'user_follows') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest
                .fn()
                .mockResolvedValue({ data: [{ following_id: 'u-3' }] }),
            };
          }
          if (table === 'moments') {
            return {
              select: jest.fn().mockReturnThis(),
              in: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue({ data: moments }),
            };
          }
          if (table === 'users') {
            return {
              select: jest.fn().mockReturnThis(),
              in: jest.fn().mockResolvedValue({
                data: [{ id: 'u-3', display_name: 'User 3' }],
              }),
            };
          }
          if (table === 'moment_likes') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              in: jest.fn().mockResolvedValue({ data: [] }),
            };
          }
          return mockQueryBuilder;
        });

      const result = await service.getFeed('user-1', 'Following');
      expect(result).toHaveLength(1);
    });

    it('should return classmates feed filtered by target language', async () => {
      const moments = [{ id: 'm-4', user_id: 'u-4' }];
      mockSupabaseClient.from = jest
        .fn()
        .mockImplementation((table: string) => {
          if (table === 'moments') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue({ data: moments }),
            };
          }
          if (table === 'users' || table === 'moment_likes') {
            return {
              select: jest.fn().mockReturnThis(),
              in: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              then: (resolve: any) => resolve({ data: [] }),
            };
          }
          return mockQueryBuilder;
        });

      const result = await service.getFeed('user-1', 'Classmates', 'fr');
      expect(result).toHaveLength(1);
    });

    it('should return generated mock moments when DB returns no moments', async () => {
      mockSupabaseClient.from = jest
        .fn()
        .mockImplementation((table: string) => {
          if (table === 'moments') {
            return {
              select: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue({ data: [] }),
            };
          }
          if (table === 'users') {
            return {
              select: jest.fn().mockReturnThis(),
              in: jest.fn().mockResolvedValue({ data: [] }),
            };
          }
          if (table === 'moment_likes') {
            return {
              select: jest.fn().mockReturnThis(),
              in: jest.fn().mockResolvedValue({ data: [] }),
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
      mockSupabaseClient.from = jest
        .fn()
        .mockImplementation((table: string) => {
          if (table === 'moment_likes') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { id: 'like-1', moment_id: 'm-1' },
              }),
              delete: jest.fn().mockReturnThis(),
            };
          }
          if (table === 'moments') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: { likes_count: 5 } }),
              update: jest.fn().mockReturnThis(),
            };
          }
          return mockQueryBuilder;
        });

      const result = await service.likeMoment('user-1', 'm-1');
      expect(result).toEqual({ likes_count: 4, is_liked: false });
    });

    it('should insert new like and increment likes_count when not liked yet', async () => {
      mockSupabaseClient.from = jest
        .fn()
        .mockImplementation((table: string) => {
          if (table === 'moment_likes') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: null }),
              insert: jest.fn().mockResolvedValue({}),
            };
          }
          if (table === 'moments') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: { likes_count: 2 } }),
              update: jest.fn().mockReturnThis(),
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

      mockSupabaseClient.from = jest
        .fn()
        .mockImplementation((table: string) => {
          if (table === 'moment_comments') {
            return {
              insert: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              single: jest
                .fn()
                .mockResolvedValue({ data: commentRow, error: null }),
            };
          }
          if (table === 'moments') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest
                .fn()
                .mockResolvedValue({ data: { comments_count: 3 } }),
              update: jest.fn().mockReturnThis(),
            };
          }
          return mockQueryBuilder;
        });

      const result = await service.addComment('user-1', 'm-1', dto);
      expect(result.id).toBe('c-1');
      expect(result.author.display_name).toBe('Serious Learner');
    });

    it('should return comments list with populated authors', async () => {
      const comments = [{ id: 'c-1', user_id: 'u-1', text_content: 'Hi' }];
      mockSupabaseClient.from = jest
        .fn()
        .mockImplementation((table: string) => {
          if (table === 'moment_comments') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({ data: comments }),
            };
          }
          if (table === 'users') {
            return {
              select: jest.fn().mockReturnThis(),
              in: jest.fn().mockResolvedValue({
                data: [{ id: 'u-1', display_name: 'Commenter' }],
              }),
            };
          }
          return mockQueryBuilder;
        });

      const result = await service.getComments('m-1');
      expect(result).toHaveLength(1);
      expect(result[0].author.display_name).toBe('Commenter');
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
      mockSupabaseClient.from = jest.fn().mockImplementation(() => {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
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
      mockSupabaseClient.from = jest
        .fn()
        .mockImplementation((table: string) => {
          if (table === 'moments') {
            callCount++;
            if (callCount === 1) {
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: { user_id: 'user-1', is_pinned: false },
                }),
              };
            } else {
              return {
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
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
  });
});
