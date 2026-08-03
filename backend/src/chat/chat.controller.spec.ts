import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ConversationStarterService } from './conversation-starter.service';
import { TranslationService } from './translation.service';

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
            lockChat: jest.fn(),
            unlockChat: jest.fn(),
            getLockedChats: jest.fn(),
          },
        },
        {
          provide: ConversationStarterService,
          useValue: {
            getSuggestions: jest.fn(),
          },
        },
        {
          provide: TranslationService,
          useValue: {
            translate: jest.fn(),
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
        mockUser().id,
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

      const result = await controller.getMessages('room-1', 'search-term');
      expect(chatService.getMessages).toHaveBeenCalledWith(
        'room-1',
        'search-term',
      );
      expect(result).toEqual(messages);
    });
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

  describe('chatLlmProxy', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.chatLlmProxy(
        null,
        {} as unknown as LlmProxyDto,
      );
      expect(result).toBeNull();
      expect(chatService.llmProxy).not.toHaveBeenCalled();
    });

    it('should call chatService.llmProxy when user is provided', async () => {
      const dto = { messageText: 'Hello' };
      (chatService.llmProxy as jest.Mock).mockResolvedValue({
        response: 'Hi there',
      });

      const result = await controller.chatLlmProxy(mockUser(), dto);
      expect(chatService.llmProxy).toHaveBeenCalledWith(
        'user-1',
        dto.messageText,
      );
      expect(result).toEqual({ response: 'Hi there' });
    });
  });

  describe('generateAiPartnerReply', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.generateAiPartnerReply(
        null,
        {} as unknown as AiGenerateReplyDto,
      );
      expect(result).toBeNull();
      expect(chatService.generateAiReply).not.toHaveBeenCalled();
    });

    it('should call chatService.generateAiReply when user is provided', async () => {
      const dto = { text: 'Hello' };
      (chatService.generateAiReply as jest.Mock).mockResolvedValue({
        response: 'Hi',
      });

      const result = await controller.generateAiPartnerReply(mockUser(), dto);
      expect(chatService.generateAiReply).toHaveBeenCalledWith(
        'user-1',
        'Hello',
      );
      expect(result).toEqual({ response: 'Hi' });
    });
  });

  describe('getSuggestedReplies', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.getSuggestedReplies(
        null,
        {} as unknown as SuggestedRepliesRequestDto,
      );
      expect(result).toBeNull();
      expect(chatService.getSuggestedReplies).not.toHaveBeenCalled();
    });

    it('should call chatService.getSuggestedReplies when user is provided', async () => {
      const dto = {
        messageText: 'hi',
      } as unknown as SuggestedRepliesRequestDto;
      (chatService.getSuggestedReplies as jest.Mock).mockResolvedValue([
        'Hello!',
        'How are you?',
      ]);

      const result = await controller.getSuggestedReplies(mockUser(), dto);
      expect(chatService.getSuggestedReplies).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual({ suggestions: ['Hello!', 'How are you?'] });
    });
  });

  describe('getConversationStarters', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.getConversationStarters(
        null,
        {} as unknown as ConversationStarterDto,
      );
      expect(result).toBeNull();
      expect(conversationStarterService.getSuggestions).not.toHaveBeenCalled();
    });

    it('should return suggestions array', async () => {
      const dto = { partnerId: 'partner-1' };
      (
        conversationStarterService.getSuggestions as jest.Mock
      ).mockResolvedValue(['What do you do?', 'Where are you from?']);

      const result = await controller.getConversationStarters(mockUser(), dto);
      expect(conversationStarterService.getSuggestions).toHaveBeenCalledWith(
        'user-1',
        'partner-1',
      );
      expect(result).toEqual({
        suggestions: ['What do you do?', 'Where are you from?'],
      });
    });
  });

  describe('translateVoiceroomText', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.translateVoiceroomText(null, {
        text: 'Hello',
        target_language: 'es',
      });
      expect(result).toBeNull();
      expect(translationService.detectLanguage).not.toHaveBeenCalled();
    });

    it('should translate using detected language', async () => {
      (translationService.detectLanguage as jest.Mock).mockResolvedValue('en');
      (translationService.translate as jest.Mock).mockResolvedValue('Hola');

      const result = await controller.translateVoiceroomText(mockUser(), {
        text: 'Hello',
        target_language: 'es',
      });
      expect(translationService.detectLanguage).toHaveBeenCalledWith('Hello');
      expect(translationService.translate).toHaveBeenCalledWith(
        'Hello',
        'en',
        'es',
      );
      expect(result).toEqual({
        translated_text: 'Hola',
        detected_language: 'en',
      });
    });
  });

  describe('translateRealTime', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.translateRealTime(null, {
        text: 'Hello',
        target_language: 'es',
      });
      expect(result).toBeNull();
      expect(translationService.translateWithDetection).not.toHaveBeenCalled();
    });

    it('should call translateWithDetection and return full payload', async () => {
      (
        translationService.translateWithDetection as jest.Mock
      ).mockResolvedValue({
        translatedText: 'Hola',
        detectedLanguage: 'en',
      });

      const result = await controller.translateRealTime(mockUser(), {
        text: 'Hello',
        target_language: 'es',
      });
      expect(translationService.translateWithDetection).toHaveBeenCalledWith(
        'Hello',
        'es',
      );
      expect(result).toEqual({
        original_text: 'Hello',
        translated_text: 'Hola',
        target_language: 'es',
        detected_language: 'en',
      });
    });
  });

  describe('replyToStatusUpdate', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.replyToStatusUpdate(
        null,
        {} as unknown as ReplyToStatusUpdateDto,
      );
      expect(result).toBeNull();
      expect(chatService.replyToStatusUpdate).not.toHaveBeenCalled();
    });

    it('should call chatService.replyToStatusUpdate when user is provided', async () => {
      const dto = {
        roomId: 'room-1',
        text: 'ok',
      } as unknown as ReplyToStatusUpdateDto;
      (chatService.replyToStatusUpdate as jest.Mock).mockResolvedValue({
        id: 'msg-2',
      });

      const result = await controller.replyToStatusUpdate(mockUser(), dto);
      expect(chatService.replyToStatusUpdate).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual({ id: 'msg-2' });
    });
  });

  describe('correctMessage', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.correctMessage(null, 'msg-1', {
        correctedText: 'fixed text',
      });
      expect(result).toBeNull();
      expect(chatService.correctMessage).not.toHaveBeenCalled();
    });

    it('should call chatService.correctMessage when user is provided', async () => {
      (chatService.correctMessage as jest.Mock).mockResolvedValue({
        id: 'msg-1',
      });

      const result = await controller.correctMessage(mockUser(), 'msg-1', {
        correctedText: 'fixed',
        explanation: 'subject-verb agreement',
      });
      expect(chatService.correctMessage).toHaveBeenCalledWith(
        'user-1',
        'msg-1',
        'fixed',
        'subject-verb agreement',
      );
      expect(result).toEqual({ id: 'msg-1' });
    });
  });

  describe('fixMessage', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.fixMessage(
        null,
        'msg-1',
        {} as unknown as FixMessageDto,
      );
      expect(result).toBeNull();
      expect(chatService.fixMessage).not.toHaveBeenCalled();
    });

    it('should call chatService.fixMessage when user is provided', async () => {
      const dto = {
        correctedText: 'fixed',
        explanation: 'notes',
      } as unknown as FixMessageDto;
      (chatService.fixMessage as jest.Mock).mockResolvedValue({ id: 'msg-1' });

      const result = await controller.fixMessage(mockUser(), 'msg-1', dto);
      expect(chatService.fixMessage).toHaveBeenCalledWith(
        'user-1',
        'msg-1',
        'fixed',
        'notes',
      );
      expect(result).toEqual({ id: 'msg-1' });
    });
  });

  describe('viewMessageMedia', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.viewMessageMedia(null, 'msg-1');
      expect(result).toBeNull();
      expect(chatService.viewMessageMedia).not.toHaveBeenCalled();
    });

    it('should call chatService.viewMessageMedia', async () => {
      (chatService.viewMessageMedia as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.viewMessageMedia(mockUser(), 'msg-1');
      expect(chatService.viewMessageMedia).toHaveBeenCalledWith(
        'user-1',
        'msg-1',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('getRoomMembers', () => {
    it('should return empty array if user is not provided', async () => {
      const result = await controller.getRoomMembers('room-1', null);
      expect(result).toEqual([]);
      expect(chatService.getGroupMembers).not.toHaveBeenCalled();
    });

    it('should map group members to the public shape', async () => {
      const members = [
        {
          user_id: 'u1',
          user: { display_name: 'Alice', avatar_url: 'url-alice' },
        },
        {
          user_id: 'u2',
          user: { display_name: 'Bob', avatar_url: null },
        },
      ] as unknown as Array<{
        user_id: string;
        user?: { display_name?: string; avatar_url?: string | null };
      }>;
      (chatService.getGroupMembers as jest.Mock).mockResolvedValue(members);

      const result = await controller.getRoomMembers('room-1', mockUser());
      expect(chatService.getGroupMembers).toHaveBeenCalledWith(
        'room-1',
        expect.any(String),
      );
      expect(result).toEqual([
        { user_id: 'u1', display_name: 'Alice', avatar_url: 'url-alice' },
        { user_id: 'u2', display_name: 'Bob', avatar_url: null },
      ]);
    });
  });

  describe('lockChat', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.lockChat(null, 'room-1');
      expect(result).toBeNull();
      expect(chatService.lockChat).not.toHaveBeenCalled();
    });

    it('should call chatService.lockChat when user is provided', async () => {
      (chatService.lockChat as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.lockChat(
        { id: 'user-1' } as any,
        'room-1',
      );
      expect(chatService.lockChat).toHaveBeenCalledWith('user-1', 'room-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('unlockChat', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.unlockChat(null, 'room-1');
      expect(result).toBeNull();
      expect(chatService.unlockChat).not.toHaveBeenCalled();
    });

    it('should call chatService.unlockChat when user is provided', async () => {
      (chatService.unlockChat as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.unlockChat(
        { id: 'user-1' } as any,
        'room-1',
      );
      expect(chatService.unlockChat).toHaveBeenCalledWith('user-1', 'room-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('getLockedRooms', () => {
    it('should return an empty array if user is not provided', async () => {
      const result = await controller.getLockedRooms(null);
      expect(result).toEqual([]);
      expect(chatService.getLockedChats).not.toHaveBeenCalled();
    });

    it('should call chatService.getLockedChats when user is provided', async () => {
      const roomIds = ['room-1', 'room-2'];
      (chatService.getLockedChats as jest.Mock).mockResolvedValue(roomIds);

      const result = await controller.getLockedRooms({ id: 'user-1' } as any);
      expect(chatService.getLockedChats).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(roomIds);
    });
  });
});
