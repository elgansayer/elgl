import type { User } from '@supabase/supabase-js';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { CentrifugoService } from './centrifugo.service';
import { ConversationStarterService } from './conversation-starter.service';
import { TranslationService } from './translation.service';
import { AddFavouriteDto } from './dto/add-favourite.dto';
import type { FavouriteRecord } from './interfaces/chat-message.interface';

describe('ChatController favourites contract', () => {
  let controller: ChatController;
  let chatService: {
    addFavourite: ReturnType<typeof vi.fn>;
    getFavourites: ReturnType<typeof vi.fn>;
    deleteFavourite: ReturnType<typeof vi.fn>;
  };

  const user = { id: 'user-1' } as unknown as User;
  const dto = {
    message_id: '00000000-0000-4000-8000-000000000001',
  } as AddFavouriteDto;

  beforeEach(() => {
    chatService = {
      addFavourite: vi.fn().mockResolvedValue(undefined),
      getFavourites: vi.fn().mockResolvedValue([]),
      deleteFavourite: vi.fn().mockResolvedValue(undefined),
    };

    controller = new ChatController(
      chatService as unknown as ChatService,
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

  it('does not add a favourite without an authenticated user', async () => {
    await expect(controller.addFavourite(null, dto)).resolves.toBeNull();
    expect(chatService.addFavourite).not.toHaveBeenCalled();
  });

  it('returns only the authenticated user favourites', async () => {
    const favourites = [{ id: 'fav-1' }] as FavouriteRecord[];
    chatService.getFavourites.mockResolvedValue(favourites);

    await expect(controller.getFavourites(user)).resolves.toEqual(favourites);
    expect(chatService.getFavourites).toHaveBeenCalledWith('user-1');
  });

  it('returns an empty list without an authenticated user', async () => {
    await expect(controller.getFavourites(null)).resolves.toEqual([]);
    expect(chatService.getFavourites).not.toHaveBeenCalled();
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
