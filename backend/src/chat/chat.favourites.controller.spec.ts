import type { User } from '@supabase/supabase-js';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { FavouritesService } from '../favourites/favourites.service';
import { CentrifugoService } from './centrifugo.service';
import { ConversationStarterService } from './conversation-starter.service';
import { TranslationService } from './translation.service';
import { AddFavouriteDto } from './dto/add-favourite.dto';
import type { FavouriteRecord } from './interfaces/chat-message.interface';

describe('ChatController favourites contract', () => {
  let controller: ChatController;
  let chatService: {
    addFavourite: ReturnType<typeof vi.fn>;
    deleteFavourite: ReturnType<typeof vi.fn>;
  };
  let favouritesService: {
    getStarredMessages: ReturnType<typeof vi.fn>;
  };

  const user = { id: 'user-1' } as unknown as User;
  const dto = {
    message_id: '00000000-0000-4000-8000-000000000001',
  } as AddFavouriteDto;

  beforeEach(() => {
    chatService = {
      addFavourite: vi.fn().mockResolvedValue(undefined),
      deleteFavourite: vi.fn().mockResolvedValue(undefined),
    };
    favouritesService = {
      getStarredMessages: vi.fn().mockResolvedValue({
        items: [],
        has_more: false,
        next_offset: null,
      }),
    };

    controller = new ChatController(
      chatService as unknown as ChatService,
      favouritesService as unknown as FavouritesService,
      {} as CentrifugoService,
      {} as ConversationStarterService,
      {} as TranslationService,
    );
  });

  it('adds a favourite for the authenticated user', async () => {
    await expect(controller.addFavourite(user, dto)).resolves.toEqual({
      success: true,
    });
    expect(chatService.addFavourite).toHaveBeenCalledWith('user-1', dto);
  });

  it('adds a favourite with note text for the authenticated user', async () => {
    const dtoWithNote = {
      message_id: '00000000-0000-4000-8000-000000000001',
      note_text: 'Important grammar correction',
    };
    await expect(controller.addFavourite(user, dtoWithNote)).resolves.toEqual({
      success: true,
    });
    expect(chatService.addFavourite).toHaveBeenCalledWith(
      'user-1',
      dtoWithNote,
    );
  });

  it('does not add a favourite without an authenticated user', async () => {
    await expect(controller.addFavourite(null, dto)).resolves.toBeNull();
    expect(chatService.addFavourite).not.toHaveBeenCalled();
  });

  it('returns only the authenticated user favourites', async () => {
    const favourites: FavouriteRecord[] = [
      {
        id: 'fav-1',
        user_id: 'user-1',
        item_type: 'message',
        item_payload: { id: 'message-1' },
        notes: null,
        created_at: '2026-10-31T00:00:00.000Z',
      },
    ];
    favouritesService.getStarredMessages.mockResolvedValue({
      items: favourites,
      has_more: false,
      next_offset: null,
    });

    await expect(controller.getFavourites(user)).resolves.toEqual(favourites);
    expect(favouritesService.getStarredMessages).toHaveBeenCalledWith(
      'user-1',
      100,
      0,
    );
  });

  it('filters out malformed items when returning favourites', async () => {
    const validFav: FavouriteRecord = {
      id: 'fav-1',
      user_id: 'user-1',
      item_type: 'message',
      item_payload: { id: 'message-1' },
      notes: null,
      created_at: '2026-10-31T00:00:00.000Z',
    };
    const malformedFav = { other: 'invalid' };
    favouritesService.getStarredMessages.mockResolvedValue({
      items: [validFav, malformedFav],
      has_more: false,
      next_offset: null,
    });

    await expect(controller.getFavourites(user)).resolves.toEqual([validFav]);
  });

  it('returns an empty list without an authenticated user', async () => {
    await expect(controller.getFavourites(null)).resolves.toEqual([]);
    expect(favouritesService.getStarredMessages).not.toHaveBeenCalled();
  });

  it('deletes a favourite in the authenticated user scope', async () => {
    await expect(controller.deleteFavourite(user, 'fav-1')).resolves.toEqual({
      success: true,
    });
    expect(chatService.deleteFavourite).toHaveBeenCalledWith('user-1', 'fav-1');
  });

  it('does not delete a favourite without an authenticated user', async () => {
    await expect(controller.deleteFavourite(null, 'fav-1')).resolves.toBeNull();
    expect(chatService.deleteFavourite).not.toHaveBeenCalled();
  });
});
