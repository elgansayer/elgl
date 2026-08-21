import type { Mock } from 'vitest';
// Mock jsdom and dompurify to avoid ESM import failures in Vitest (transitively imported through chat -> link-preview)
vi.mock('jsdom', () => ({
  JSDOM: vi.fn().mockImplementation(function () {
    return {
      window: {
        document: { createElement: vi.fn(), createDocumentFragment: vi.fn() },
      },
    };
  }),
}));
vi.mock('dompurify', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    sanitize: vi.fn((d: string) => d.replace(/<[^>]*>/g, '')),
    setConfig: vi.fn(),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { CentrifugoService } from './centrifugo.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ConversationStarterService } from './conversation-starter.service';
import { TranslationService } from './translation.service';
import type { User } from '@supabase/supabase-js';
import { AiGenerateReplyDto, SendMessageDto } from './dto/send-message.dto';
import { AddFavouriteDto } from './dto/add-favourite.dto';
import { ConversationStarterDto } from './dto/conversation-starter.dto';
import { ReplyToStatusUpdateDto } from './dto/reply-to-status-update.dto';
import { SuggestedRepliesRequestDto } from './dto/suggested-replies-request.dto';
import { FixMessageDto } from './dto/fix-message.dto';
import { AddLabelDto, RemoveLabelDto } from './dto/label.dto';
import { LlmProxyDto } from './dto/llm-proxy.dto';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: ChatService;
  let centrifugoService: CentrifugoService;
  let conversationStarterService: ConversationStarterService;
  let translationService: TranslationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: {
            generateConnectionToken: vi.fn(),
            sendMessage: vi.fn(),
            getRooms: vi.fn(),
            getMessages: vi.fn(),
            addFavourite: vi.fn(),
            getFavourites: vi.fn(),
            deleteFavourite: vi.fn(),
            llmProxy: vi.fn(),
            generateAiReply: vi.fn(),
            getSuggestedReplies: vi.fn(),
            replyToStatusUpdate: vi.fn(),
            correctMessage: vi.fn(),
            fixMessage: vi.fn(),
            updateMessageStatus: vi.fn(),
            viewMessageMedia: vi.fn(),
            getGroupMembers: vi.fn(),
            lockChat: vi.fn(),
            unlockChat: vi.fn(),
            getLockedChats: vi.fn(),
            addLabel: vi.fn(),
            removeLabel: vi.fn(),
            getUserLabels: vi.fn(),
            getRoomsByLabel: vi.fn(),
            exportChatHistory: vi.fn(),
            getRoomGreeting: vi.fn(),
          },
        },
        {
          provide: CentrifugoService,
          useValue: {
            checkConnectionRateLimit: vi.fn().mockResolvedValue(true),
            generateConnectionToken: vi.fn(),
            publish: vi.fn(),
            signJwt: vi.fn(),
          },
        },
        {
          provide: ConversationStarterService,
          useValue: {
            getSuggestions: vi.fn(),
          },
        },
        {
          provide: TranslationService,
          useValue: {
            detectLanguage: vi.fn(),
            translate: vi.fn(),
            translateWithDetection: vi.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<ChatController>(ChatController);
    chatService = module.get<ChatService>(ChatService);
    centrifugoService = module.get<CentrifugoService>(CentrifugoService);
    conversationStarterService = module.get<ConversationStarterService>(
      ConversationStarterService,
    );
    translationService = module.get<TranslationService>(TranslationService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function mockUser(): User {
    return { id: 'user-1' } as unknown as User;
  }

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getConnectionToken', () => {
    const mockReq = () => ({ headers: {}, ip: '127.0.0.1' }) as unknown as any;

    const mockRes = () => {
      const res: Record<string, any> = {};
      res.status = vi.fn().mockReturnValue(res);
      res.json = vi.fn().mockReturnValue(res);
      res.header = vi.fn().mockReturnValue(res);
      return res as unknown as any;
    };

    it('should respond with 401 if user is not provided', async () => {
      const res = mockRes();
      await controller.getConnectionToken(null, mockReq(), res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(null);
    });

    it('should return connection token when user is provided and rate limit allows', async () => {
      (centrifugoService.checkConnectionRateLimit as Mock).mockResolvedValue({
        allowed: true,
        retryAfterMs: 0,
      });
      (chatService.generateConnectionToken as Mock).mockResolvedValue(
        'ws-token',
      );

      const res = mockRes();
      await controller.getConnectionToken(mockUser(), mockReq(), res);
      expect(centrifugoService.checkConnectionRateLimit).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
      );
      expect(chatService.generateConnectionToken).toHaveBeenCalledWith(
        mockUser().id,
      );
      expect(res.json).toHaveBeenCalledWith({ token: 'ws-token' });
    });

    it('should respond with 429 when rate limit is exceeded', async () => {
      (centrifugoService.checkConnectionRateLimit as Mock).mockResolvedValue({
        allowed: false,
        retryAfterMs: 30000,
      });

      const res = mockRes();
      await controller.getConnectionToken(mockUser(), mockReq(), res);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.header).toHaveBeenCalledWith('Retry-After', '30');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 429,
          message: expect.stringContaining(
            'Too many WebSocket connection attempts',
          ),
        }),
      );
    });
  });

  describe('sendMessage', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.sendMessage(
        null,
        {} as unknown as SendMessageDto,
      );
      expect(result).toBeNull();
      expect(chatService.sendMessage).not.toHaveBeenCalled();
    });

    it('should call chatService.sendMessage when user is provided', async () => {
      const dto = {
        roomId: 'room-1',
        text: 'Hello',
      } as unknown as SendMessageDto;
      const savedMessage = { id: 'msg-1' };
      (chatService.sendMessage as Mock).mockResolvedValue(savedMessage);

      const result = await controller.sendMessage(mockUser(), dto);
      expect(chatService.sendMessage).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(savedMessage);
    });
  });

  describe('getRooms', () => {
    it('should return empty array if user is not provided', async () => {
      const result = await controller.getRooms(null);
      expect(result).toEqual([]);
      expect(chatService.getRooms).not.toHaveBeenCalled();
    });

    it('should call chatService.getRooms when user is provided', async () => {
      const rooms = [{ id: 'global-exchange' }];
      (chatService.getRooms as Mock).mockResolvedValue(rooms);

      const result = await controller.getRooms(mockUser());
      expect(chatService.getRooms).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(rooms);
    });
  });

  describe('getMessages', () => {
    it('should call chatService.getMessages without user when omitted', async () => {
      const messages = [{ id: 'msg-1' }];
      (chatService.getMessages as Mock).mockResolvedValue(messages);

      const result = await controller.getMessages('room-1', 'search-term');
      expect(chatService.getMessages).toHaveBeenCalledWith(
        'room-1',
        'search-term',
      );
      expect(result).toEqual(messages);
    });

    it('should pass user id when user is provided', async () => {
      (chatService.getMessages as Mock).mockResolvedValue([]);
      const result = await controller.getMessages('room-1', '', mockUser());
      expect(chatService.getMessages).toHaveBeenCalledWith(
        'room-1',
        '',
        'user-1',
      );
      expect(result).toEqual([]);
    });
  });

  describe('addFavourite', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.addFavourite(
        null,
        {} as unknown as AddFavouriteDto,
      );
      expect(result).toBeNull();
      expect(chatService.addFavourite).not.toHaveBeenCalled();
    });

    it('should call chatService.addFavourite when user is provided', async () => {
      const dto = { messageId: 'msg-1' } as unknown as AddFavouriteDto;
      (chatService.addFavourite as Mock).mockResolvedValue(undefined);

      const result = await controller.addFavourite(mockUser(), dto);
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
      const favourites = [{ id: 'fav-1' }];
      (chatService.getFavourites as Mock).mockResolvedValue(favourites);

      const result = await controller.getFavourites(mockUser());
      expect(chatService.getFavourites).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(favourites);
    });
  });

  describe('deleteFavourite', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.deleteFavourite(null, 'fav-1');
      expect(result).toBeNull();
      expect(chatService.deleteFavourite).not.toHaveBeenCalled();
    });

    it('should call chatService.deleteFavourite when user is provided', async () => {
      (chatService.deleteFavourite as Mock).mockResolvedValue(undefined);

      const result = await controller.deleteFavourite(mockUser(), 'fav-1');
      expect(chatService.deleteFavourite).toHaveBeenCalledWith(
        'user-1',
        'fav-1',
      );
      expect(result).toEqual({ success: true });
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
      (chatService.llmProxy as Mock).mockResolvedValue({
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
      (chatService.generateAiReply as Mock).mockResolvedValue({
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
      (chatService.getSuggestedReplies as Mock).mockResolvedValue([
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
      (conversationStarterService.getSuggestions as Mock).mockResolvedValue([
        'What do you do?',
        'Where are you from?',
      ]);

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
      (translationService.detectLanguage as Mock).mockResolvedValue('en');
      (translationService.translate as Mock).mockResolvedValue('Hola');

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
      (translationService.translateWithDetection as Mock).mockResolvedValue({
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
      (chatService.replyToStatusUpdate as Mock).mockResolvedValue({
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
      (chatService.correctMessage as Mock).mockResolvedValue({
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
      (chatService.fixMessage as Mock).mockResolvedValue({ id: 'msg-1' });

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

  describe('updateMessageStatus', () => {
    it('should return null if user is not provided', async () => {
      const dto = { status: 'delivered' as const };
      const result = await controller.updateMessageStatus(null, 'msg-1', dto);
      expect(result).toBeNull();
      expect(chatService.updateMessageStatus).not.toHaveBeenCalled();
    });

    it('should call chatService.updateMessageStatus when user is provided', async () => {
      const dto = { status: 'read' as const };
      (chatService.updateMessageStatus as Mock).mockResolvedValue(undefined);

      const result = await controller.updateMessageStatus(
        mockUser(),
        'msg-1',
        dto,
      );
      expect(chatService.updateMessageStatus).toHaveBeenCalledWith(
        'user-1',
        'msg-1',
        'read',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('viewMessageMedia', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.viewMessageMedia(null, 'msg-1');
      expect(result).toBeNull();
      expect(chatService.viewMessageMedia).not.toHaveBeenCalled();
    });

    it('should call chatService.viewMessageMedia', async () => {
      (chatService.viewMessageMedia as Mock).mockResolvedValue(undefined);

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
      (chatService.getGroupMembers as Mock).mockResolvedValue(members);

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
      (chatService.lockChat as Mock).mockResolvedValue(undefined);

      const result = await controller.lockChat(mockUser(), 'room-1');
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
      (chatService.unlockChat as Mock).mockResolvedValue(undefined);

      const result = await controller.unlockChat(mockUser(), 'room-1');
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
      (chatService.getLockedChats as Mock).mockResolvedValue(roomIds);

      const result = await controller.getLockedRooms(mockUser());
      expect(chatService.getLockedChats).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(roomIds);
    });
  });

  describe('Labels', () => {
    describe('addLabel', () => {
      it('should return null if user is not provided', async () => {
        const result = await controller.addLabel(
          null,
          {} as unknown as AddLabelDto,
        );
        expect(result).toBeNull();
        expect(chatService.addLabel).not.toHaveBeenCalled();
      });

      it('should call chatService.addLabel', async () => {
        const dto = { room_id: 'room-1', label: 'work' };
        (chatService.addLabel as Mock).mockResolvedValue(undefined);

        const result = await controller.addLabel(mockUser(), dto);
        expect(chatService.addLabel).toHaveBeenCalledWith(
          'user-1',
          'room-1',
          'work',
        );
        expect(result).toEqual({ success: true });
      });
    });

    describe('removeLabel', () => {
      it('should return null if user is not provided', async () => {
        const result = await controller.removeLabel(
          null,
          {} as unknown as RemoveLabelDto,
        );
        expect(result).toBeNull();
        expect(chatService.removeLabel).not.toHaveBeenCalled();
      });

      it('should call chatService.removeLabel', async () => {
        const dto = { room_id: 'room-1', label: 'work' };
        (chatService.removeLabel as Mock).mockResolvedValue(undefined);

        const result = await controller.removeLabel(mockUser(), dto);
        expect(chatService.removeLabel).toHaveBeenCalledWith(
          'user-1',
          'room-1',
          'work',
        );
        expect(result).toEqual({ success: true });
      });
    });

    describe('getUserLabels', () => {
      it('should return empty array if user is not provided', async () => {
        const result = await controller.getUserLabels(null);
        expect(result).toEqual([]);
        expect(chatService.getUserLabels).not.toHaveBeenCalled();
      });

      it('should call chatService.getUserLabels', async () => {
        const labels = ['work', 'family'];
        (chatService.getUserLabels as Mock).mockResolvedValue(labels);

        const result = await controller.getUserLabels(mockUser());
        expect(chatService.getUserLabels).toHaveBeenCalledWith('user-1');
        expect(result).toEqual(labels);
      });
    });

    describe('getRoomsByLabel', () => {
      it('should return empty array if user is not provided', async () => {
        const result = await controller.getRoomsByLabel(null, 'work');
        expect(result).toEqual([]);
        expect(chatService.getRoomsByLabel).not.toHaveBeenCalled();
      });

      it('should call chatService.getRoomsByLabel', async () => {
        const rooms = [{ id: 'room-1' }];
        (chatService.getRoomsByLabel as Mock).mockResolvedValue(rooms);

        const result = await controller.getRoomsByLabel(mockUser(), 'work');
        expect(chatService.getRoomsByLabel).toHaveBeenCalledWith(
          'user-1',
          'work',
        );
        expect(result).toEqual(rooms);
      });
    });
  });

  describe('exportChatHistory', () => {
    it('should return empty array if user is not provided', async () => {
      const result = await controller.exportChatHistory(null, 'room-1');
      expect(result).toEqual([]);
      expect(chatService.exportChatHistory).not.toHaveBeenCalled();
    });

    it('should call chatService.exportChatHistory', async () => {
      const messages = [{ id: 'msg-1' }];
      (chatService.exportChatHistory as Mock).mockResolvedValue(messages);

      const result = await controller.exportChatHistory(mockUser(), 'room-1');
      expect(chatService.exportChatHistory).toHaveBeenCalledWith(
        'user-1',
        'room-1',
      );
      expect(result).toEqual(messages);
    });
  });

  describe('getRoomGreeting', () => {
    it('should return empty object if user is not provided', async () => {
      const result = await controller.getRoomGreeting(null, 'room-1');
      expect(result).toEqual({});
      expect(chatService.getRoomGreeting).not.toHaveBeenCalled();
    });

    it('should call chatService.getRoomGreeting', async () => {
      const greeting = {
        greetingMessage: 'Welcome!',
        awayMessage: 'Please leave a message.',
      };
      (chatService.getRoomGreeting as Mock).mockResolvedValue(greeting);

      const result = await controller.getRoomGreeting(mockUser(), 'room-1');
      expect(chatService.getRoomGreeting).toHaveBeenCalledWith(
        'room-1',
        'user-1',
      );
      expect(result).toEqual(greeting);
    });
  });
});
