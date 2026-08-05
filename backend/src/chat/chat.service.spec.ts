import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from './centrifugo.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SafetyService } from '../safety/safety.service';
import { LinkPreviewService } from '../link-preview/link-preview.service';
import { SystemMessageService } from './services/system-message.service';
import { SpamDetectionService } from '../spam-detection/spam-detection.service';
import { ChatLlmService } from './chat-llm.service';
import { XpService } from '../xp/xp.service';

jest.mock('./centrifugo.service', () => ({
  CentrifugoService: jest.fn(),
}));

describe('ChatService', () => {
  let service: ChatService;
  let centrifugoService: any;
  let chatLlmService: any;
  let eventEmitter: any;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      match: jest.fn().mockReturnThis(),
      patch: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn().mockReturnThis(),
      // Make the builder thenable so that `await supabase.from(...)` calls resolve
      then: jest.fn((resolve) => resolve({ data: [] })),
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
            signJwt: jest.fn().mockResolvedValue('mock-token'),
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
        {
          provide: LinkPreviewService,
          useValue: {
            fetchPreview: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: SystemMessageService,
          useValue: {
            publishToRoom: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: SpamDetectionService,
          useValue: {
            isSpam: jest.fn().mockReturnValue(false),
          },
        },
        {
          provide: ChatLlmService,
          useValue: {
            generateText: jest.fn(),
            proxyMessage: jest.fn(),
          },
        },
        {
          provide: XpService,
          useValue: {
            awardXpForActivity: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    centrifugoService = module.get<CentrifugoService>(CentrifugoService) as any;
    chatLlmService = module.get<ChatLlmService>(ChatLlmService) as any;
    eventEmitter = module.get<EventEmitter2>(EventEmitter2) as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateCentrifugoToken', () => {
    it('should generate token via CentrifugoService', async () => {
      const result = await service.generateConnectionToken('user-1');
      expect(centrifugoService.signJwt).toHaveBeenCalledWith({
        sub: 'user-1',
        exp: expect.any(Number),
      });
      expect(result).toBe('mock-token');
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
        reply_to_id: null,
        correction_request_payload: null,
        status_reply_payload: null,
        is_view_once: false,
      });
      expect(centrifugoService.publish).toHaveBeenCalledWith('chat:room-1', {
        message: savedMessage,
      });
      expect(result).toEqual(savedMessage);
    }, 15000);

    it('should throw Error when insert fails with error message', async () => {
      const dto: any = { room_id: 'room-1', message_type: 'TEXT' };
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Database insert failed' },
      });

      await expect(service.sendMessage('sender-1', dto)).rejects.toThrow(
        'Failed to save message: Database insert failed',
      );
    }, 15000);

    it('should throw Error when insert returns null data without error message', async () => {
      const dto: any = { room_id: 'room-1', message_type: 'TEXT' };
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(service.sendMessage('sender-1', dto)).rejects.toThrow(
        'Failed to save message',
      );
    }, 15000);

    it('should generate AI explanation for correction payload when explanation is missing', async () => {
      const dto: any = {
        room_id: 'room-1',
        message_type: 'correction',
        correction_payload: {
          original: 'I goed to store',
          corrected: 'I went to the store',
        },
      };
      const savedMessage = {
        id: 'msg-1',
        room_id: 'room-1',
        sender_id: 'sender-1',
        message_type: 'correction',
        correction_payload: {
          original: 'I goed to store',
          corrected: 'I went to the store',
        },
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: savedMessage,
        error: null,
      });
      (chatLlmService.proxyMessage as jest.Mock).mockResolvedValue({
        response: 'The past tense of "go" is "went".',
      });

      const result = (await service.sendMessage('sender-1', dto)) as any;

      expect(chatLlmService.proxyMessage).toHaveBeenCalled();
      expect(result.correction_payload.explanation).toBe(
        'The past tense of "go" is "went".',
      );
    }, 15000);

    it('should emit a chat.mention event for each mentioned participant', async () => {
      const dto: any = {
        room_id: 'room-1',
        message_type: 'text',
        text_content: 'Hey @Alice check this out, cc @Bob',
      };
      const savedMessage = {
        id: 'msg-1',
        room_id: 'room-1',
        sender_id: 'sender-1',
        message_type: 'text',
        text_content: dto.text_content,
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: savedMessage,
        error: null,
      });
      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) => resolve({ data: [] }))
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [
              { user_id: 'alice-id', user: { display_name: 'Alice' } },
              { user_id: 'bob-id', user: { display_name: 'Bob' } },
              { user_id: 'sender-1', user: { display_name: 'SenderName' } },
            ],
          }),
        );

      await service.sendMessage('sender-1', dto);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'chat.mention',
        expect.objectContaining({
          actorId: 'sender-1',
          mentionedUserId: 'alice-id',
          roomId: 'room-1',
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'chat.mention',
        expect.objectContaining({
          actorId: 'sender-1',
          mentionedUserId: 'bob-id',
          roomId: 'room-1',
        }),
      );
    }, 15000);

    it('should not emit a mention event when the sender mentions themselves', async () => {
      const dto: any = {
        room_id: 'room-1',
        message_type: 'text',
        text_content: 'Note to @SenderName',
      };
      const savedMessage = {
        id: 'msg-1',
        room_id: 'room-1',
        sender_id: 'sender-1',
        message_type: 'text',
        text_content: dto.text_content,
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: savedMessage,
        error: null,
      });
      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) => resolve({ data: [] }))
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [
              { user_id: 'sender-1', user: { display_name: 'SenderName' } },
            ],
          }),
        );

      await service.sendMessage('sender-1', dto);

      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        'chat.mention',
        expect.anything(),
      );
    }, 15000);

    it('should not emit mention events when the message has no @mentions', async () => {
      const dto: any = {
        room_id: 'room-1',
        message_type: 'text',
        text_content: 'Just a normal message',
      };
      const savedMessage = {
        id: 'msg-1',
        room_id: 'room-1',
        sender_id: 'sender-1',
        message_type: 'text',
        text_content: dto.text_content,
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: savedMessage,
        error: null,
      });

      await service.sendMessage('sender-1', dto);

      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        'chat.mention',
        expect.anything(),
      );
    }, 15000);
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
      expect(result).toEqual(
        rooms.map((room) => ({ ...room, is_locked: false })),
      );
    });

    it('should hide rooms the user has locked from the list', async () => {
      const rooms = [{ id: 'global-exchange' }, { id: 'english-spanish' }];
      mockQueryBuilder.order
        .mockReturnValueOnce(mockQueryBuilder)
        .mockResolvedValueOnce({
          data: rooms,
          error: null,
        });
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({ data: [{ room_id: 'english-spanish' }], error: null }),
      );

      const result = await service.getRooms('user-1');

      expect(result).toEqual([{ id: 'global-exchange', is_locked: false }]);
    });

    it('should keep all rooms when retrieving locked chats fails', async () => {
      const rooms = [{ id: 'global-exchange' }, { id: 'english-spanish' }];
      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: rooms, error: null }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: null, error: { message: 'Locked query failed' } }),
        );

      const result = await service.getRooms('user-1');

      expect(result).toEqual(
        rooms.map((room) => ({ ...room, is_locked: false })),
      );
    });

    it('should return fallback mock rooms when rooms query fails', async () => {
      mockQueryBuilder.order
        .mockReturnValueOnce(mockQueryBuilder)
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Query failed' },
        });

      const result = await service.getRooms('user-1');
      // The service returns pre-seeded fallback rooms when the query fails
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'mock-room-1',
        title: 'Spanish Practice',
        is_online: true,
        is_pinned: true,
      });
      expect(result[1]).toMatchObject({
        id: 'mock-room-2',
        title: 'Language Exchange - JP/EN',
        is_online: false,
        is_pinned: false,
      });
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

    it('should return fallback mock messages when query returns error or null data', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: null,
        error: { message: 'Error' },
      });

      const result = await service.getMessages('room-1');
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 'mock-msg-1', room_id: 'room-1' });
      expect(result[1]).toMatchObject({ id: 'mock-msg-2', room_id: 'room-1' });
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

  describe('deleteFavourite', () => {
    it('should delete a favourite by id and user', async () => {
      await service.deleteFavourite('user-1', 'fav-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('favourites');
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'fav-1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });
  });

  describe('lockChat', () => {
    it('should mark the room as locked for the given user', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({ error: null }),
      );

      await service.lockChat('user-1', 'room-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('chat_room_members');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        is_locked: true,
      });
      expect(mockQueryBuilder.match).toHaveBeenCalledWith({
        user_id: 'user-1',
        room_id: 'room-1',
      });
    });

    it('should throw when the update fails', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({ error: { message: 'Update failed' } }),
      );

      await expect(service.lockChat('user-1', 'room-1')).rejects.toThrow(
        'Failed to lock chat: Update failed',
      );
    });
  });

  describe('unlockChat', () => {
    it('should mark the room as unlocked for the given user', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({ error: null }),
      );

      await service.unlockChat('user-1', 'room-1');

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        is_locked: false,
      });
      expect(mockQueryBuilder.match).toHaveBeenCalledWith({
        user_id: 'user-1',
        room_id: 'room-1',
      });
    });

    it('should throw when the update fails', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({ error: { message: 'Update failed' } }),
      );

      await expect(service.unlockChat('user-1', 'room-1')).rejects.toThrow(
        'Failed to unlock chat: Update failed',
      );
    });
  });

  describe('getLockedChats', () => {
    it('should return the ids of rooms the user has locked', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({
          data: [{ room_id: 'room-1' }, { room_id: 'room-2' }],
          error: null,
        }),
      );

      const result = await service.getLockedChats('user-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('chat_room_members');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('is_locked', true);
      expect(result).toEqual(['room-1', 'room-2']);
    });

    it('should return an empty array when there are no locked rooms', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({
          data: [],
          error: null,
        }),
      );

      const result = await service.getLockedChats('user-1');

      expect(result).toEqual([]);
    });

    it('should throw when the query fails', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({ data: null, error: { message: 'Query failed' } }),
      );

      await expect(service.getLockedChats('user-1')).rejects.toThrow(
        'Failed to get locked chats: Query failed',
      );
    });
  });

  describe('exportChatHistory', () => {
    it('should return the list of messages for a room when the user is a member', async () => {
      const roomId = 'room-export-1';
      const memberRows = { data: [{ user_id: 'user-1' }], error: null };
      const messages = [
        { id: 'msg-1', room_id: roomId, text_content: 'Hello' },
        { id: 'msg-2', room_id: roomId, text_content: 'World' },
      ];

      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) => resolve(memberRows))
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: messages, error: null }),
        );

      const result = await service.exportChatHistory('user-1', roomId);

      expect(mockSupabaseClient.from).toHaveBeenNthCalledWith(
        1,
        'chat_room_members',
      );
      expect(mockSupabaseClient.from).toHaveBeenNthCalledWith(
        2,
        'chat_messages',
      );
      expect(mockQueryBuilder.select).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('room_id', roomId);
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', {
        ascending: true,
      });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(1000);
      expect(result).toEqual(messages);
    });

    it('should throw ForbiddenException when the user is not a member', async () => {
      const roomId = 'private-room';
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({ data: null, error: null }),
      );

      await expect(service.exportChatHistory('user-1', roomId)).rejects.toThrow(
        'You are not a member of this room',
      );
    });

    it('should throw an Error when fetching messages fails', async () => {
      const roomId = 'room-error';
      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: [{ user_id: 'user-1' }], error: null }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: null, error: { message: 'DB failed' } }),
        );

      await expect(service.exportChatHistory('user-1', roomId)).rejects.toThrow(
        'Failed to fetch messages: DB failed',
      );
    });
  });
});
