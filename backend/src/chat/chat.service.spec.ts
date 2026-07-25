import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from './centrifugo.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SafetyService } from '../safety/safety.service';

jest.mock('./centrifugo.service', () => ({
  CentrifugoService: jest.fn(),
}));

describe('ChatService', () => {
  let service: ChatService;
  let centrifugoService: any;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: CentrifugoService,
          useValue: {
            generateConnectionToken: jest
              .fn()
              .mockReturnValue({ token: 'mock-token' }),
            publish: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: SafetyService,
          useValue: {
            getBlockedAndBlockerIds: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    centrifugoService = module.get<CentrifugoService>(CentrifugoService) as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateConnectionToken', () => {
    it('should generate connection token via CentrifugoService', () => {
      const result = service.generateConnectionToken('user-1');
      expect(centrifugoService.generateConnectionToken).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual({ token: 'mock-token' });
    });
  });

  describe('sendMessage', () => {
    it('should save message and publish to Centrifugo channel', async () => {
      const dto: any = {
        room_id: 'room-1',
        message_type: 'TEXT',
        text_content: 'Hello World',
        media_url: null,
        correction_payload: null,
      };

      const savedMessage = {
        id: 'msg-1',
        room_id: 'room-1',
        sender_id: 'sender-1',
        message_type: 'TEXT',
        text_content: 'Hello World',
      };

      mockQueryBuilder.single.mockResolvedValue({
        data: savedMessage,
        error: null,
      });

      const result = await service.sendMessage('sender-1', dto);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('chat_messages');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        room_id: 'room-1',
        sender_id: 'sender-1',
        message_type: 'TEXT',
        text_content: 'Hello World',
        media_url: null,
        correction_payload: null,
      });
      expect(centrifugoService.publish).toHaveBeenCalledWith('chat:room-1', {
        message: savedMessage,
      });
      expect(result).toEqual(savedMessage);
    });

    it('should throw Error when insert fails with error message', async () => {
      const dto: any = { room_id: 'room-1', message_type: 'TEXT' };
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Database insert failed' },
      });

      await expect(service.sendMessage('sender-1', dto)).rejects.toThrow(
        'Failed to save message: Database insert failed',
      );
    });

    it('should throw Error when insert returns null data without error message', async () => {
      const dto: any = { room_id: 'room-1', message_type: 'TEXT' };
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(service.sendMessage('sender-1', dto)).rejects.toThrow(
        'Failed to save message: Unknown error',
      );
    });
  });

  describe('getRooms', () => {
    it('should return chat rooms ordered by pinned and creation', async () => {
      const rooms = [{ id: 'global-exchange' }, { id: 'english-spanish' }];
      mockQueryBuilder.order
        .mockReturnValueOnce(mockQueryBuilder)
        .mockResolvedValueOnce({
          data: rooms,
          error: null,
        });

      const result = await service.getRooms('user-1');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('chat_rooms');
      expect(result).toEqual(rooms);
    });

    it('should return empty array when rooms query fails', async () => {
      mockQueryBuilder.order
        .mockReturnValueOnce(mockQueryBuilder)
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Query failed' },
        });

      const result = await service.getRooms('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('getMessages', () => {
    it('should return messages for room without search filter', async () => {
      const messages = [{ id: 'msg-1', text_content: 'Hi' }];
      mockQueryBuilder.limit.mockResolvedValue({
        data: messages,
        error: null,
      });

      const result = await service.getMessages('room-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('chat_messages');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('room_id', 'room-1');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', {
        ascending: true,
      });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(100);
      expect(mockQueryBuilder.ilike).not.toHaveBeenCalled();
      expect(result).toEqual(messages);
    });

    it('should apply search filter using ilike when search query is provided and non-empty', async () => {
      const messages = [{ id: 'msg-2', text_content: 'Hello friend' }];
      mockQueryBuilder.ilike.mockResolvedValue({
        data: messages,
        error: null,
      });

      const result = await service.getMessages('room-1', '  friend  ');

      expect(mockQueryBuilder.ilike).toHaveBeenCalledWith(
        'text_content',
        '%friend%',
      );
      expect(result).toEqual(messages);
    });

    it('should return empty array when query returns error or null data', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: null,
        error: { message: 'Error' },
      });

      const result = await service.getMessages('room-1');
      expect(result).toEqual([]);
    });
  });

  describe('addFavourite', () => {
    // We create independent builders for this describe block so they don't
    // interfere with the shared `mockQueryBuilder` used by other tests.
    let mockChatMessagesBuilder: any;
    let mockFavouritesBuilder: any;

    beforeEach(() => {
      mockChatMessagesBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
      };

      mockFavouritesBuilder = {
        insert: jest.fn(),
      };

      // Override `mockSupabaseClient.from` only inside `addFavourite` tests.
      // We restore the default behaviour in afterEach.
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'chat_messages') {
          return mockChatMessagesBuilder;
        }
        if (table === 'favourites') {
          return mockFavouritesBuilder;
        }
        return mockQueryBuilder;
      });
    });

    afterEach(() => {
      // Restore the default `from` behaviour for other test suites.
      mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);
    });

    it('should save favourite record and return void', async () => {
      const dto: any = { message_id: 'msg-1', note_text: 'My favourite note' };
      const message = { id: 'msg-1', text_content: 'Hello' };

      mockChatMessagesBuilder.single.mockResolvedValue({
        data: message,
        error: null,
      });
      mockFavouritesBuilder.insert.mockResolvedValue({ error: null });

      await service.addFavourite('user-1', dto);

      expect(mockChatMessagesBuilder.single).toHaveBeenCalled();
      expect(mockFavouritesBuilder.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        item_type: 'message',
        item_payload: message,
        notes: 'My favourite note',
      });
    });

    it('should throw Error when addFavourite fails with error message', async () => {
      const dto: any = { message_id: 'msg-1' };

      mockChatMessagesBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Message not found error' },
      });

      await expect(service.addFavourite('user-1', dto)).rejects.toThrow(
        'Message not found',
      );
    });
  });

  describe('getFavourites', () => {
    it('should return list of favourite records for user', async () => {
      const favourites = [{ id: 'fav-1', message_id: 'msg-1' }];
      mockQueryBuilder.limit.mockResolvedValue({
        data: favourites,
        error: null,
      });

      const result = await service.getFavourites('user-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('favourites');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(100);
      expect(result).toEqual(favourites);
    });

    it('should return empty array when getFavourites returns error or null data', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: null,
        error: { message: 'Query error' },
      });

      const result = await service.getFavourites('user-1');
      expect(result).toEqual([]);
    });
  });
});
