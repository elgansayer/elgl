import { BadRequestException } from '@nestjs/common';
import { MomentsController } from './moments.controller';
import { MomentsFeedService } from './moments-feed.service';
import { MomentsService } from './moments.service';
import { UsersService } from '../users/users.service';
import { R2Service } from '../cloudflare-r2/r2.service';

const user = { id: 'viewer-1' } as any;

describe('MomentsController feed filters', () => {
  let controller: MomentsController;
  let momentsFeedService: { getFeed: ReturnType<typeof vi.fn> };
  let usersService: { getProfile: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    momentsFeedService = {
      getFeed: vi.fn().mockResolvedValue([]),
    };
    usersService = {
      getProfile: vi.fn(),
    };

    controller = new MomentsController(
      {} as MomentsService,
      momentsFeedService as unknown as MomentsFeedService,
      usersService as unknown as UsersService,
      {} as R2Service,
    );
  });

  it('uses All by default and keeps the established feed route contract', async () => {
    momentsFeedService.getFeed.mockResolvedValue([
      { id: 'moment-1', user_id: 'author-1' },
    ]);

    const result = await controller.getFeed(user);

    expect(momentsFeedService.getFeed).toHaveBeenCalledWith(
      'viewer-1',
      'All',
      undefined,
    );
    expect(result).toEqual([{ id: 'moment-1', user_id: 'author-1' }]);
  });

  it('normalises an explicit Classmates language before querying the feed', async () => {
    momentsFeedService.getFeed.mockResolvedValue([
      { id: 'moment-fr', user_id: 'author-1' },
    ]);

    const result = await controller.getFeed(user, 'Classmates', ' FR ');

    expect(usersService.getProfile).not.toHaveBeenCalled();
    expect(momentsFeedService.getFeed).toHaveBeenCalledWith(
      'viewer-1',
      'Classmates',
      'fr',
    );
    expect(result).toHaveLength(1);
  });

  it("derives Classmates from the viewer's primary target language", async () => {
    usersService.getProfile.mockResolvedValue({
      id: 'viewer-1',
      target_languages: ['JA', 'fr'],
    });

    await controller.getFeed(user, 'Classmates');

    expect(usersService.getProfile).toHaveBeenCalledWith('viewer-1');
    expect(momentsFeedService.getFeed).toHaveBeenCalledWith(
      'viewer-1',
      'Classmates',
      'ja',
    );
  });

  it('returns an honest empty Classmates feed when the viewer has no target language', async () => {
    usersService.getProfile.mockResolvedValue({
      id: 'viewer-1',
      target_languages: [],
    });

    const result = await controller.getFeed(user, 'Classmates');

    expect(result).toEqual([]);
    expect(momentsFeedService.getFeed).not.toHaveBeenCalled();
  });

  it('routes Following through the feed policy boundary', async () => {
    momentsFeedService.getFeed.mockResolvedValue([
      { id: 'followed-moment', user_id: 'author-2' },
    ]);

    const result = await controller.getFeed(user, 'Following');

    expect(momentsFeedService.getFeed).toHaveBeenCalledWith(
      'viewer-1',
      'Following',
      undefined,
    );
    expect(result).toEqual([{ id: 'followed-moment', user_id: 'author-2' }]);
  });

  it('rejects unsupported filter values instead of silently broadening the feed', async () => {
    await expect(controller.getFeed(user, 'Everyone')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(momentsFeedService.getFeed).not.toHaveBeenCalled();
  });
});
