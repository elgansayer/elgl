import { ForbiddenException } from '@nestjs/common';
import { FavouritesController } from './favourites.controller';
import { FavouritesService } from './favourites.service';

const request = { user: { id: 'user-1' } };

describe('FavouritesController', () => {
  let controller: FavouritesController;
  let service: {
    addFavourite: ReturnType<typeof vi.fn>;
    removeFavourite: ReturnType<typeof vi.fn>;
    getUserFavourites: ReturnType<typeof vi.fn>;
    getStarredMessages: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      addFavourite: vi.fn().mockResolvedValue({ success: true }),
      removeFavourite: vi.fn().mockResolvedValue({ success: true }),
      getUserFavourites: vi.fn().mockResolvedValue([]),
      getStarredMessages: vi.fn().mockResolvedValue({
        items: [],
        has_more: false,
        next_offset: null,
      }),
    };
    controller = new FavouritesController(
      service as unknown as FavouritesService,
    );
  });

  it('reads the authenticated user favourites without a user id parameter', async () => {
    await expect(controller.getMyFavourites(request)).resolves.toEqual([]);
    expect(service.getUserFavourites).toHaveBeenCalledWith('user-1');
  });

  it('retrieves a bounded starred-message page for the authenticated user', async () => {
    await expect(
      controller.getStarredMessages(request, { limit: 25, offset: 50 }),
    ).resolves.toEqual({
      items: [],
      has_more: false,
      next_offset: null,
    });
    expect(service.getStarredMessages).toHaveBeenCalledWith('user-1', 25, 50);
  });

  it('keeps the legacy user route owner-scoped', async () => {
    await expect(
      controller.getUserFavourites(request, 'user-1'),
    ).resolves.toEqual([]);
    expect(service.getUserFavourites).toHaveBeenCalledWith('user-1');
  });

  it('rejects attempts to read another user through the legacy route', async () => {
    await expect(
      controller.getUserFavourites(request, 'user-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.getUserFavourites).not.toHaveBeenCalled();
  });
});
