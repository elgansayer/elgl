import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { MomentsController } from './moments.controller';
import { MomentsService } from './moments.service';
import { UsersService } from '../users/users.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { R2Service } from '../cloudflare-r2/r2.service';

describe('MomentsController', () => {
  let controller: MomentsController;
  let momentsService: MomentsService;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MomentsController],
      providers: [
        {
          provide: MomentsService,
          useValue: {
            createMoment: vi.fn(),
            getFeed: vi.fn(),
            likeMoment: vi.fn(),
            addComment: vi.fn(),
            getComments: vi.fn(),
            pinMoment: vi.fn(),
            getLifetimeCounts: vi.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getProfile: vi.fn(),
          },
        },
        {
          provide: R2Service,
          useValue: {},
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<MomentsController>(MomentsController);
    momentsService = module.get<MomentsService>(MomentsService);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createMoment', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.createMoment(null, {} as any);
      expect(result).toBeNull();
      expect(momentsService.createMoment).not.toHaveBeenCalled();
    });

    it('should call service createMoment when user is provided', async () => {
      const dto: any = { text_content: 'Test' };
      const moment: any = { id: 'm-1', ...dto };
      (momentsService.createMoment as Mock).mockResolvedValue(moment);

      const result = await controller.createMoment(
        { id: 'user-1' } as any,
        dto,
      );
      expect(momentsService.createMoment).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(moment);
    });
  });

  describe('getFeed', () => {
    it('should return empty array if user is not provided', async () => {
      const result = await controller.getFeed(null);
      expect(result).toEqual([]);
      expect(momentsService.getFeed).not.toHaveBeenCalled();
    });

    it('should call service getFeed with active filter and lang when user is provided', async () => {
      const feed: any[] = [{ id: 'm-1' }];
      (momentsService.getFeed as Mock).mockResolvedValue(feed);

      const result = await controller.getFeed(
        { id: 'user-1' } as any,
        'Classmates',
        'fr',
      );
      expect(momentsService.getFeed).toHaveBeenCalledWith(
        'user-1',
        'Classmates',
        'fr',
      );
      expect(result).toEqual(feed);
    });

    it('should use All as default filter when filter is undefined', async () => {
      const feed: any[] = [{ id: 'm-1' }];
      (momentsService.getFeed as Mock).mockResolvedValue(feed);

      const result = await controller.getFeed({ id: 'user-1' } as any);
      expect(momentsService.getFeed).toHaveBeenCalledWith(
        'user-1',
        'All',
        undefined,
      );
      expect(result).toEqual(feed);
    });
  });

  describe('likeMoment', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.likeMoment(null, 'm-1');
      expect(result).toBeNull();
      expect(momentsService.likeMoment).not.toHaveBeenCalled();
    });

    it('should call service likeMoment when user is provided', async () => {
      const response = { likes_count: 5, is_liked: true };
      (momentsService.likeMoment as Mock).mockResolvedValue(response);

      const result = await controller.likeMoment(
        { id: 'user-1' } as any,
        'm-1',
      );
      expect(momentsService.likeMoment).toHaveBeenCalledWith('user-1', 'm-1');
      expect(result).toEqual(response);
    });
  });

  describe('addComment', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.addComment(null, 'm-1', {});
      expect(result).toBeNull();
      expect(momentsService.addComment).not.toHaveBeenCalled();
    });

    it('should call service addComment when user is provided', async () => {
      const dto: any = { text_content: 'Nice' };
      const comment: any = { id: 'c-1', ...dto };
      (momentsService.addComment as Mock).mockResolvedValue(comment);

      const result = await controller.addComment(
        { id: 'user-1' } as any,
        'm-1',
        dto,
      );
      expect(momentsService.addComment).toHaveBeenCalledWith(
        'user-1',
        'm-1',
        dto,
      );
      expect(result).toEqual(comment);
    });
  });

  describe('getComments', () => {
    it('should call service getComments for specific moment', async () => {
      const comments: any[] = [{ id: 'c-1' }];
      (momentsService.getComments as Mock).mockResolvedValue(comments);

      const result = await controller.getComments(
        { id: 'user-1' } as any,
        'm-1',
      );
      expect(momentsService.getComments).toHaveBeenCalledWith('m-1', 'user-1');
      expect(result).toEqual(comments);
    });
  });

  describe('pinMoment', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.pinMoment(null, 'm-1');
      expect(result).toBeNull();
      expect(momentsService.pinMoment).not.toHaveBeenCalled();
    });

    it('should get profile and call service pinMoment when user is provided', async () => {
      const profile: any = { id: 'user-1', is_vip: true };
      const moment: any = { id: 'm-1', is_pinned: true };
      (usersService.getProfile as Mock).mockResolvedValue(profile);
      (momentsService.pinMoment as Mock).mockResolvedValue(moment);

      const result = await controller.pinMoment({ id: 'user-1' } as any, 'm-1');
      expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
      expect(momentsService.pinMoment).toHaveBeenCalledWith(
        'user-1',
        true,
        'm-1',
      );
      expect(result).toEqual(moment);
    });

    it('should fallback to false when user profile has undefined is_vip', async () => {
      (usersService.getProfile as Mock).mockResolvedValue({});
      (momentsService.pinMoment as Mock).mockResolvedValue({ id: 'm-1' });

      await controller.pinMoment({ id: 'user-1' } as any, 'm-1');
      expect(momentsService.pinMoment).toHaveBeenCalledWith(
        'user-1',
        false,
        'm-1',
      );
    });
  });

  describe('getLifetimeCounts', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.getLifetimeCounts(null);
      expect(result).toBeNull();
      expect(momentsService.getLifetimeCounts).not.toHaveBeenCalled();
    });

    it('should call service getLifetimeCounts when user is provided', async () => {
      const counts = { translations: 42, corrections: 17 };
      (momentsService.getLifetimeCounts as Mock).mockResolvedValue(counts);

      const result = await controller.getLifetimeCounts({
        id: 'user-1',
      } as any);
      expect(momentsService.getLifetimeCounts).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(counts);
    });
  });
});
