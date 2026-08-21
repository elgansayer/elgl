import { Test, TestingModule } from '@nestjs/testing';
import { StudyBuddiesController } from './study-buddies.controller';
import { StudyBuddiesService } from './study-buddies.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { StudyBuddiesRateLimiterGuard } from './study-buddies-rate-limiter.guard';

describe('StudyBuddiesController', () => {
  let controller: StudyBuddiesController;
  let service: StudyBuddiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudyBuddiesController],
      providers: [
        {
          provide: StudyBuddiesService,
          useValue: {
            requestBuddy: vi.fn().mockResolvedValue({ id: 'req-1' }),
            getIncomingRequests: vi.fn().mockResolvedValue([{ id: 'req-1' }]),
            respondToRequest: vi
              .fn()
              .mockResolvedValue({ id: 'req-1', status: 'accepted' }),
            getPotentialBuddies: vi.fn().mockResolvedValue([{ id: 'user-2' }]),
            followUser: vi.fn().mockResolvedValue(undefined),
            unfollowUser: vi.fn().mockResolvedValue(undefined),
            getOrCreateChannel: vi
              .fn()
              .mockReturnValue({ channel: 'chat_user-1_user-2' }),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .overrideGuard(StudyBuddiesRateLimiterGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<StudyBuddiesController>(StudyBuddiesController);
    service = module.get<StudyBuddiesService>(StudyBuddiesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('requests a buddy for the authenticated user', async () => {
    await controller.requestBuddy(
      { partnerId: 'user-2' },
      { user: { sub: 'user-1' } },
    );
    expect(service.requestBuddy).toHaveBeenCalledWith(
      { partnerId: 'user-2' },
      'user-1',
    );
  });

  it('fetches incoming requests for the authenticated user', async () => {
    await controller.getIncomingRequests({ user: { sub: 'user-2' } });
    expect(service.getIncomingRequests).toHaveBeenCalledWith('user-2');
  });

  it('accepts a request', async () => {
    await controller.acceptRequest('req-1', { user: { sub: 'user-2' } });
    expect(service.respondToRequest).toHaveBeenCalledWith(
      'req-1',
      'user-2',
      'accepted',
    );
  });

  it('declines a request', async () => {
    await controller.declineRequest('req-1', { user: { sub: 'user-2' } });
    expect(service.respondToRequest).toHaveBeenCalledWith(
      'req-1',
      'user-2',
      'declined',
    );
  });

  it('fetches potential matches', async () => {
    await controller.getMatches({ user: { sub: 'user-1' } });
    expect(service.getPotentialBuddies).toHaveBeenCalledWith('user-1');
  });

  it('follows a user', async () => {
    const result = await controller.followUser('user-2', {
      user: { sub: 'user-1' },
    });
    expect(service.followUser).toHaveBeenCalledWith('user-1', 'user-2');
    expect(result).toEqual({ message: 'Followed' });
  });

  it('unfollows a user', async () => {
    const result = await controller.unfollowUser('user-2', {
      user: { sub: 'user-1' },
    });
    expect(service.unfollowUser).toHaveBeenCalledWith('user-1', 'user-2');
    expect(result).toEqual({ message: 'Unfollowed' });
  });

  it('gets a chat channel', () => {
    const result = controller.getChannel('user-2', { user: { sub: 'user-1' } });
    expect(service.getOrCreateChannel).toHaveBeenCalledWith('user-1', 'user-2');
    expect(result).toEqual({ channel: 'chat_user-1_user-2' });
  });
});
