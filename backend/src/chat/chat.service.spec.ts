import type { Mock } from 'vitest';
// Mock jsdom and dompurify to avoid ESM import failures in Vitest (transitively imported through link-preview)
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
import { ConfigService } from '@nestjs/config';
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
import { UsersService } from '../users/users.service';

vi.mock('./centrifugo.service', () => ({
  CentrifugoService: vi.fn(),
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
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      match: vi.fn().mockReturnThis(),
      patch: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      // Make the builder thenable so that `await supabase.from(...)` calls resolve
      then: vi.fn((resolve) => resolve({ data: [] })),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: CentrifugoService,
          useValue: {
            signJwt: vi.fn().mockResolvedValue('mock-token'),
            publish: vi.fn().mockResolvedValue(true),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: vi.fn() },
        },
        {
          provide: SafetyService,
          useValue: {
            getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]),
          },
        },
        {
          provide: LinkPreviewService,
          useValue: {
            fetchPreview: vi.fn().mockResolvedValue({}),
          },
        },
        {
          provide: SystemMessageService,
          useValue: {
            publishToRoom: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: SpamDetectionService,
          useValue: {
            isSpam: vi.fn().mockReturnValue(false),
          },
        },
        {
          provide: ChatLlmService,
          useValue: {
            generateText: vi.fn(),
            proxyMessage: vi.fn(),
          },
        },
        {
          provide: XpService,
          useValue: {
            awardXpForActivity: vi.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getMessageFilters: vi.fn().mockResolvedValue({}),
            getProfile: vi.fn().mockResolvedValue(null),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockReturnValue(5),
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
    vi.clearAllMocks();
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
        delivery_status: 'sent',
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
      (chatLlmService.proxyMessage as Mock).mockResolvedValue({
        response:
          'The past tense of "go" is "went". For example: "I went to the store yesterday."',
      });

      const result = (await service.sendMessage('sender-1', dto)) as any;

      expect(chatLlmService.proxyMessage).toHaveBeenCalledWith(
        expect.stringContaining('You are a language teacher'),
      );
      expect(chatLlmService.proxyMessage).toHaveBeenCalledWith(
        expect.stringContaining(
          'Explain why the following sentence was corrected.',
        ),
      );
      expect(result.correction_payload.explanation).toBe(
        'The past tense of "go" is "went". For example: "I went to the store yesterday."',
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

    it('should reject initial message when sender native language not in receiver allowed_native_languages', async () => {
      const dto: any = {
        room_id: 'room-1',
        message_type: 'text',
        text_content: 'Hi!',
      };

      const originalFrom = mockSupabaseClient.from;
      let usersCallCount = 0;
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'chat_room_members') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockResolvedValue({
              data: [{ user_id: 'receiver-1' }],
              error: null,
            }),
          };
        }
        if (table === 'chat_messages') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: vi.fn((resolve: any) => resolve({ count: 0, error: null })),
          };
        }
        if (table === 'users') {
          usersCallCount++;
          if (usersCallCount === 1) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  message_filters: {
                    allowed_native_languages: ['ja'],
                  },
                },
                error: null,
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { native_languages: ['en'], age: 25, gender: 'male' },
              error: null,
            }),
          };
        }
        return mockQueryBuilder;
      });

      await expect(service.sendMessage('sender-1', dto)).rejects.toThrow(
        'You cannot send the first message to this user due to their native language filter settings.',
      );

      mockSupabaseClient.from = originalFrom;
    }, 15000);

    it('should reject initial message when sender age is below receiver age_min', async () => {
      const dto: any = {
        room_id: 'room-1',
        message_type: 'text',
        text_content: 'Hi!',
      };

      let usersCallCount = 0;
      const originalFrom = mockSupabaseClient.from;
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'chat_room_members') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockResolvedValue({
              data: [{ user_id: 'receiver-1' }],
              error: null,
            }),
          };
        }
        if (table === 'chat_messages') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: vi.fn((resolve: any) => resolve({ count: 0, error: null })),
          };
        }
        if (table === 'users') {
          usersCallCount++;
          if (usersCallCount === 1) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  message_filters: { age_min: 30 },
                },
                error: null,
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { native_languages: ['en'], age: 25, gender: 'male' },
              error: null,
            }),
          };
        }
        return mockQueryBuilder;
      });

      await expect(service.sendMessage('sender-1', dto)).rejects.toThrow(
        'You cannot send the first message to this user due to their age filter settings.',
      );

      mockSupabaseClient.from = originalFrom;
    }, 15000);

    it('should reject initial message when sender age is above receiver age_max', async () => {
      const dto: any = {
        room_id: 'room-1',
        message_type: 'text',
        text_content: 'Hi!',
      };

      let usersCallCount = 0;
      const originalFrom = mockSupabaseClient.from;
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'chat_room_members') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockResolvedValue({
              data: [{ user_id: 'receiver-1' }],
              error: null,
            }),
          };
        }
        if (table === 'chat_messages') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: vi.fn((resolve: any) => resolve({ count: 0, error: null })),
          };
        }
        if (table === 'users') {
          usersCallCount++;
          if (usersCallCount === 1) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  message_filters: { age_max: 40 },
                },
                error: null,
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { native_languages: ['en'], age: 55, gender: 'male' },
              error: null,
            }),
          };
        }
        return mockQueryBuilder;
      });

      await expect(service.sendMessage('sender-1', dto)).rejects.toThrow(
        'You cannot send the first message to this user due to their age filter settings.',
      );

      mockSupabaseClient.from = originalFrom;
    }, 15000);

    it('should reject initial message when sender gender not in receiver allowed_genders', async () => {
      const dto: any = {
        room_id: 'room-1',
        message_type: 'text',
        text_content: 'Hi!',
      };

      let usersCallCount = 0;
      const originalFrom = mockSupabaseClient.from;
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'chat_room_members') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockResolvedValue({
              data: [{ user_id: 'receiver-1' }],
              error: null,
            }),
          };
        }
        if (table === 'chat_messages') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: vi.fn((resolve: any) => resolve({ count: 0, error: null })),
          };
        }
        if (table === 'users') {
          usersCallCount++;
          if (usersCallCount === 1) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  message_filters: { allowed_genders: ['female'] },
                },
                error: null,
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { native_languages: ['en'], age: 25, gender: 'male' },
              error: null,
            }),
          };
        }
        return mockQueryBuilder;
      });

      await expect(service.sendMessage('sender-1', dto)).rejects.toThrow(
        'You cannot send the first message to this user due to their gender filter settings.',
      );

      mockSupabaseClient.from = originalFrom;
    }, 15000);

    it('should allow subsequent messages even when sender would not pass filters', async () => {
      const dto: any = {
        room_id: 'room-1',
        message_type: 'text',
        text_content: 'Hello again!',
      };

      const savedMessage = {
        id: 'msg-1',
        room_id: 'room-1',
        sender_id: 'sender-1',
        message_type: 'text',
        text_content: 'Hello again!',
      };

      const originalFrom = mockSupabaseClient.from;
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'chat_room_members') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockResolvedValue({
              data: [{ user_id: 'receiver-1' }],
              error: null,
            }),
          };
        }
        if (table === 'chat_messages') {
          // First call to chat_messages is count query - return count > 0
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: vi.fn((resolve: any) => resolve({ count: 5, error: null })),
            single: vi.fn().mockResolvedValue({
              data: savedMessage,
              error: null,
            }),
            insert: vi.fn().mockReturnThis(),
          };
        }
        return mockQueryBuilder;
      });

      // Should NOT throw - subsequent messages bypass filters
      const result = await service.sendMessage('sender-1', dto);
      expect(result).toBeDefined();

      mockSupabaseClient.from = originalFrom;
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
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };

      mockFavouritesBuilder = {
        insert: vi.fn(),
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

  describe('updateMessageStatus', () => {
    it('should update delivery_status from sent to delivered', async () => {
      const message = {
        id: 'msg-1',
        room_id: 'room-1',
        delivery_status: 'sent',
      };
      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: message, error: null }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: { user_id: 'user-1' }, error: null }),
        )
        .mockImplementationOnce((resolve: any) => resolve({ error: null }));

      await service.updateMessageStatus('user-1', 'msg-1', 'delivered');

      expect(mockSupabaseClient.from).toHaveBeenNthCalledWith(
        1,
        'chat_messages',
      );
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        delivery_status: 'delivered',
      });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'msg-1');
      expect(centrifugoService.publish).toHaveBeenCalledWith(
        'chat:room-1',
        expect.objectContaining({
          status_update: expect.objectContaining({
            message_id: 'msg-1',
            delivery_status: 'delivered',
          }),
        }),
      );
    });

    it('should update delivery_status from delivered to read', async () => {
      const message = {
        id: 'msg-2',
        room_id: 'room-2',
        delivery_status: 'delivered',
      };
      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: message, error: null }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: { user_id: 'user-1' }, error: null }),
        )
        .mockImplementationOnce((resolve: any) => resolve({ error: null }));

      await service.updateMessageStatus('user-1', 'msg-2', 'read');

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        delivery_status: 'read',
      });
      expect(centrifugoService.publish).toHaveBeenCalledWith(
        'chat:room-2',
        expect.objectContaining({
          status_update: expect.objectContaining({
            message_id: 'msg-2',
            delivery_status: 'read',
          }),
        }),
      );
    });

    it('should not downgrade status from read to delivered', async () => {
      const message = {
        id: 'msg-3',
        room_id: 'room-3',
        delivery_status: 'read',
      };
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({ data: message, error: null }),
      );

      await service.updateMessageStatus('user-1', 'msg-3', 'delivered');

      // The method should return early without calling update
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
      expect(centrifugoService.publish).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when message does not exist', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({ data: null, error: null }),
      );

      await expect(
        service.updateMessageStatus('user-1', 'msg-nonexistent', 'delivered'),
      ).rejects.toThrow('Message not found');
    });

    it('should throw ForbiddenException when user is not a room member', async () => {
      const message = {
        id: 'msg-4',
        room_id: 'room-4',
        delivery_status: 'sent',
      };
      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: message, error: null }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: null, error: null }),
        );

      await expect(
        service.updateMessageStatus('user-1', 'msg-4', 'delivered'),
      ).rejects.toThrow('Not a member of this room');
    });

    it('should throw Error when update fails', async () => {
      const message = {
        id: 'msg-5',
        room_id: 'room-5',
        delivery_status: 'sent',
      };
      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: message, error: null }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: { user_id: 'user-1' }, error: null }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ error: { message: 'DB error' } }),
        );

      await expect(
        service.updateMessageStatus('user-1', 'msg-5', 'read'),
      ).rejects.toThrow('Failed to update message status: DB error');
    });

    it('should treat missing delivery_status as sent', async () => {
      const message = {
        id: 'msg-6',
        room_id: 'room-6',
        delivery_status: null as string | null,
      };
      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: message, error: null }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: { user_id: 'user-1' }, error: null }),
        )
        .mockImplementationOnce((resolve: any) => resolve({ error: null }));

      await service.updateMessageStatus('user-1', 'msg-6', 'delivered');

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        delivery_status: 'delivered',
      });
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

  describe('editMessage', () => {
    const messageId = 'msg-edit-123';
    const roomId = 'room-edit-1';
    const senderId = 'sender-edit-1';
    const otherUserId = 'other-user-edit-1';
    const dto = { text_content: 'edited text' };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should edit a text message and publish via Centrifugo', async () => {
      const createdAt = new Date().toISOString();

      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: {
              id: messageId,
              sender_id: senderId,
              message_type: 'text',
              room_id: roomId,
              created_at: createdAt,
              text_content: 'original text',
            },
            error: null,
          }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: { user_id: senderId }, error: null }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: {
              id: messageId,
              room_id: roomId,
              sender_id: senderId,
              message_type: 'text',
              text_content: 'edited text',
              is_edited: true,
              edited_at: new Date().toISOString(),
              is_read: false,
              created_at: createdAt,
            },
            error: null,
          }),
        );

      const result = await service.editMessage(senderId, messageId, dto);

      expect(result.text_content).toBe('edited text');
      expect(result.is_edited).toBe(true);
      expect(centrifugoService.publish).toHaveBeenCalledWith(
        `chat:${roomId}`,
        expect.objectContaining({ message: expect.anything() }),
      );
    });

    it('should throw NotFoundException when message is not found', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({ data: null, error: { message: 'Not found' } }),
      );

      await expect(
        service.editMessage(senderId, messageId, dto),
      ).rejects.toThrow('Message not found');
    });

    it('should throw ForbiddenException when user is not the sender', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({
          data: {
            id: messageId,
            sender_id: otherUserId,
            message_type: 'text',
            room_id: roomId,
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      );

      await expect(
        service.editMessage(senderId, messageId, dto),
      ).rejects.toThrow('You can only edit your own messages');
    });

    it('should throw BadRequestException when message is not text type', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({
          data: {
            id: messageId,
            sender_id: senderId,
            message_type: 'voice',
            room_id: roomId,
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      );

      await expect(
        service.editMessage(senderId, messageId, dto),
      ).rejects.toThrow('Only text messages can be edited');
    });

    it('should throw ForbiddenException when edit window has expired', async () => {
      const oldDate = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago

      mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({
          data: {
            id: messageId,
            sender_id: senderId,
            message_type: 'text',
            room_id: roomId,
            created_at: oldDate,
          },
          error: null,
        }),
      );

      await expect(
        service.editMessage(senderId, messageId, dto),
      ).rejects.toThrow(
        'Messages can only be edited within 5 minutes of sending',
      );
    });

    it('should throw ForbiddenException when user is not a room member', async () => {
      const createdAt = new Date().toISOString();

      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: {
              id: messageId,
              sender_id: senderId,
              message_type: 'text',
              room_id: roomId,
              created_at: createdAt,
            },
            error: null,
          }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: null, error: null }),
        );

      await expect(
        service.editMessage(senderId, messageId, dto),
      ).rejects.toThrow('You are not a member of this room');
    });
  });
});
