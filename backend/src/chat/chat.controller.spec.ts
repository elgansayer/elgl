import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: {
            generateConnectionToken: jest.fn(),
            getRooms: jest.fn(),
            sendMessage: jest.fn(),
            getMessages: jest.fn(),
            addFavourite: jest.fn(),
            getFavourites: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<ChatController>(ChatController);
    chatService = module.get<ChatService>(ChatService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getConnectionToken', () => {
    it('should return null if user is not provided', () => {
      const result = controller.getConnectionToken(null);
      expect(result).toBeNull();
      expect(chatService.generateConnectionToken).not.toHaveBeenCalled();
    });

    it('should return connection token when user is provided', () => {
      const mockToken = { token: 'ws-token' };
      (chatService.generateConnectionToken as jest.Mock).mockReturnValue(
        mockToken,
      );

      const result = controller.getConnectionToken({ id: 'user-1' } as any);
      expect(chatService.generateConnectionToken).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual(mockToken);
    });
  });

  describe('sendMessage', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.sendMessage(null, {} as any);
      expect(result).toBeNull();
      expect(chatService.sendMessage).not.toHaveBeenCalled();
    });

    it('should call chatService.sendMessage when user is provided', async () => {
      const dto: any = { room_id: 'room-1', text_content: 'Hello' };
      const savedMessage: any = { id: 'msg-1', ...dto };
      (chatService.sendMessage as jest.Mock).mockResolvedValue(savedMessage);

      const result = await controller.sendMessage({ id: 'user-1' } as any, dto);
      expect(chatService.sendMessage).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(savedMessage);
    });
  });

  describe('getMessages', () => {
    it('should call chatService.getMessages with room ID and search query', async () => {
      const messages: any[] = [{ id: 'msg-1' }];
      (chatService.getMessages as jest.Mock).mockResolvedValue(messages);

      const result = await controller.getMessages(
        { id: 'user-1' } as any,
        'room-1',
        'search-term'
      );
      expect(chatService.getMessages).toHaveBeenCalledWith(
        'room-1',
        'search-term',
        'user-1'
      );
      expect(result).toEqual(messages);
    });

    describe('getRooms', () => {
      it('should call chatService.getRooms', async () => {
        const rooms: any[] = [{ id: 'global-exchange' }];
        (chatService.getRooms as jest.Mock).mockResolvedValue(rooms);

        const result = await controller.getRooms({ id: 'user-1' } as any);
        expect(chatService.getRooms).toHaveBeenCalledWith('user-1');
        expect(result).toEqual(rooms);
      });
    });
  });

  describe('addFavourite', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.addFavourite(null, {} as any);
      expect(result).toBeNull();
      expect(chatService.addFavourite).not.toHaveBeenCalled();
    });

    it('should call chatService.addFavourite when user is provided', async () => {
      const dto: any = { message_id: 'msg-1' };
      (chatService.addFavourite as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.addFavourite(
        { id: 'user-1' } as any,
        dto,
      );
      expect(chatService.addFavourite).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual({ success: true });
    });
  });

  describe('getFavourites', () => {
    it('should return empty array if user is not provided', async () => {
      const result = await controller.getFavourites(null);
      expect(result).toEqual([]);
      expect(chatService.getFavourites).not.toHaveBeenCalled();
    });

    it('should call chatService.getFavourites when user is provided', async () => {
      const favourites: any[] = [{ id: 'fav-1' }];
      (chatService.getFavourites as jest.Mock).mockResolvedValue(favourites);

      const result = await controller.getFavourites({ id: 'user-1' } as any);
      expect(chatService.getFavourites).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(favourites);
    });
  });
});
