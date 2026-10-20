import { BadRequestException } from '@nestjs/common';
import { MomentsController } from './moments.controller';
import { MomentsService } from './moments.service';
import { UsersService } from '../users/users.service';
import { R2Service } from '../cloudflare-r2/r2.service';

const user = { id: 'viewer-1' } as any;

describe('MomentsController feed filters', () => {
  let controller: MomentsController;
  let momentsService: { getFeed: ReturnType<typeof vi.fn> };
  let usersService: { getProfile: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    momentsService = {
      getFeed: vi.fn().mockResolvedValue([]),
    };
    usersService = {
      getProfile: vi.fn(),
    };

    controller = new MomentsController(
      momentsService as unknown as MomentsService,
      usersService as unknown as UsersService,
      {} as R2Service,
    );
  });

  it('uses All by default and keeps the established feed route contract', async () => {
    momentsService.getFeed.mockResolvedValue([
      { id: 'moment-1', user_id: 'author-1' },
    ]);

    const result = await controller.getFeed(user);

    expect(momentsService.getFeed).toHaveBeenCalledWith(
      'viewer-1',
      'All',
      undefined,
    );
    expect(result).toEqual([{ id: 'moment-1', user_id: 'author-1' }]);
  });

  it('normalises an explicit Classmates language before querying the feed', async () => {
    momentsService.getFeed.mockResolvedValue([
      { id: 'moment-fr', user_id: 'author-1' },
    ]);

    const result = await controller.getFeed(user, 'Classmates', ' FR ');

    expect(usersService.getProfile).not.toHaveBeenCalled();
    expect(momentsService.getFeed).toHaveBeenCalledWith(
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
    momentsService.getFeed.mockResolvedValue([
      { id: 'moment-ja', user_id: 'author-1' },
    ]);

    await controller.getFeed(user, 'Classmates');

    expect(usersService.getProfile).toHaveBeenCalledWith('viewer-1');
    expect(momentsService.getFeed).toHaveBeenCalledWith(
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
    expect(momentsService.getFeed).not.toHaveBeenCalled();
  });

  it('keeps Following limited to followed users rather than the viewer', async () => {
    momentsService.getFeed.mockResolvedValue([
      { id: 'own-moment', user_id: 'viewer-1' },
      { id: 'followed-moment', user_id: 'author-2' },
    ]);

    const result = await controller.getFeed(user, 'Following');

    expect(result).toEqual([{ id: 'followed-moment', user_id: 'author-2' }]);
  });

  it('does not expose generated mock Moments through production feed filters', async () => {
    momentsService.getFeed.mockResolvedValue([
      { id: 'mock-moment-1', user_id: 'fake-1' },
      { id: 'real-moment', user_id: 'author-1' },
    ]);

    const result = await controller.getFeed(user, 'All');

    expect(result).toEqual([{ id: 'real-moment', user_id: 'author-1' }]);
  });

  it('rejects unsupported filter values instead of silently broadening the feed', async () => {
    await expect(controller.getFeed(user, 'Everyone')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(momentsService.getFeed).not.toHaveBeenCalled();
  });
});
