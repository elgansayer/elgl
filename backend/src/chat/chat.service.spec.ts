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
import { ReadReceiptsService } from './read-receipts.service';
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
  let safetyService: SafetyService;
  let readReceipts: {
    markAsDelivered: Mock;
    updateStatus: Mock;
    markRead: Mock;
    getReceiptStatus: Mock;
  };

  beforeEach(async () => {
    readReceipts = {
      markAsDelivered: vi.fn().mockResolvedValue(undefined),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue({ marked: 0 }),
      getReceiptStatus: vi.fn(),
    };
    mockQueryBuilder = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
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
        { provide: ReadReceiptsService, useValue: readReceipts },
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
    safetyService = module.get<SafetyService>(SafetyService);
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

  describe('room-scoped realtime authorisation', () => {
    beforeEach(() => {
      mockQueryBuilder.maybeSingle.mockResolvedValue({
        data: { user_id: 'user-1' },
        error: null,
      });
    });

    it.each([
      ['messages', 'chat:room-1'],
      ['typing', 'chat:room-1:typing'],
    ] as const)(
      'mints a short-lived %s subscription token only after membership verification',
      async (stream, channel) => {
        await expect(
          service.generateSubscriptionToken('user-1', 'room-1', stream),
        ).resolves.toBe('mock-token');

        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('room_id', 'room-1');
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
        expect(centrifugoService.signJwt).toHaveBeenCalledWith({
          sub: 'user-1',
          channel,
          exp: expect.any(Number),
        });
      },
    );

    it('refuses a subscription token to an outsider without disclosing a missing message', async () => {
      mockQueryBuilder.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'room-1' }, error: null });

      await expect(
        service.generateSubscriptionToken('outsider', 'room-1', 'messages'),
      ).rejects.toThrow('Not a member of this room');

      expect(centrifugoService.signJwt).not.toHaveBeenCalled();
    });

    it('publishes authenticated typing state from the API without trusting a client user id', async () => {
      await service.sendTyping('user-1', {
        room_id: 'room-1',
        is_typing: true,
      });

      expect(centrifugoService.publish).toHaveBeenCalledWith(
        'chat:room-1:typing',
        {
          userId: 'user-1',
          typing: true,
          timestamp: expect.any(Number),
        },
      );
    });

    it('does not publish typing state for an outsider', async () => {
      mockQueryBuilder.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'room-1' }, error: null });

      await expect(
        service.sendTyping('outsider', {
          room_id: 'room-1',
          is_typing: true,
        }),
      ).rejects.toThrow('Not a member of this room');

      expect(centrifugoService.publish).not.toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    beforeEach(() => {
      mockQueryBuilder.maybeSingle.mockResolvedValue({
        data: { user_id: 'sender-1' },
        error: null,
      });
    });

    it('rejects an outsider before persisting or publishing a message', async () => {
      mockQueryBuilder.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'room-1' }, error: null });

      await expect(
        service.sendMessage('outsider', {
          room_id: 'room-1',
          message_type: 'text',
          text_content: 'Private message',
        }),
      ).rejects.toThrow('Not a member of this room');

      expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
      expect(centrifugoService.publish).not.toHaveBeenCalled();
    });

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
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: [], error: null }),
        )
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
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: [], error: null }),
        )
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
            maybeSingle: vi.fn().mockResolvedValue({
              data: { user_id: 'sender-1' },
              error: null,
            }),
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
            maybeSingle: vi.fn().mockResolvedValue({
              data: { user_id: 'sender-1' },
              error: null,
            }),
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
            maybeSingle: vi.fn().mockResolvedValue({
              data: { user_id: 'sender-1' },
              error: null,
            }),
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
            maybeSingle: vi.fn().mockResolvedValue({
              data: { user_id: 'sender-1' },
              error: null,
            }),
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
            maybeSingle: vi.fn().mockResolvedValue({
              data: { user_id: 'sender-1' },
              error: null,
            }),
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
    it('should return only the caller rooms ordered by pinned and creation', async () => {
      const rooms = [{ id: 'global-exchange' }, { id: 'english-spanish' }];
      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [
              { room_id: 'global-exchange', is_locked: false },
              { room_id: 'english-spanish', is_locked: false },
            ],
            error: null,
          }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: rooms, error: null }),
        );

      const result = await service.getRooms('user-1');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('chat_rooms');
      expect(mockQueryBuilder.in).toHaveBeenCalledWith('id', [
        'global-exchange',
        'english-spanish',
      ]);
      expect(result).toEqual(
        rooms.map((room) => ({ ...room, is_locked: false })),
      );
    });

    it('should return caller lock state when routed-room metadata requests it', async () => {
      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [{ room_id: 'english-spanish', is_locked: true }],
            error: null,
          }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: [{ id: 'english-spanish' }], error: null }),
        );

      const result = await service.getRooms('user-1', true);

      expect(result).toEqual([{ id: 'english-spanish', is_locked: true }]);
    });

    it('should hide locked rooms from the ordinary inbox by default', async () => {
      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [{ room_id: 'english-spanish', is_locked: true }],
            error: null,
          }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: [{ id: 'english-spanish' }], error: null }),
        );

      const result = await service.getRooms('user-1');

      expect(result).toEqual([]);
    });

    it('should hide a group when any other member is blocked', async () => {
      vi.mocked(safetyService.getBlockedAndBlockerIds).mockResolvedValue([
        'blocked-user',
      ]);
      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [
              { room_id: 'room-with-block', is_locked: false },
              { room_id: 'room-visible', is_locked: false },
            ],
            error: null,
          }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [{ id: 'room-with-block' }, { id: 'room-visible' }],
            error: null,
          }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [
              { room_id: 'room-with-block', user_id: 'blocked-user' },
              { room_id: 'room-with-block', user_id: 'allowed-user' },
              { room_id: 'room-visible', user_id: 'allowed-user' },
            ],
            error: null,
          }),
        );

      const result = await service.getRooms('user-1');

      expect(result).toEqual([{ id: 'room-visible', is_locked: false }]);
    });

    it('should fail closed when blocked-member filtering cannot be completed', async () => {
      vi.mocked(safetyService.getBlockedAndBlockerIds).mockResolvedValue([
        'blocked-user',
      ]);
      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [{ room_id: 'room-1', is_locked: false }],
            error: null,
          }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [{ id: 'room-1' }],
            error: null,
          }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: null,
            error: { message: 'Member query failed' },
          }),
        );

      await expect(service.getRooms('user-1')).rejects.toThrow(
        'Chat room membership could not be loaded',
      );
    });

    it('should return an empty list when the caller has no room memberships', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({ data: [], error: null }),
      );

      const result = await service.getRooms('user-1');

      expect(result).toEqual([]);
      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('chat_rooms');
    });

    it('should surface a membership failure instead of exposing or inventing rooms', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({ data: null, error: { message: 'Membership query failed' } }),
      );

      await expect(service.getRooms('user-1')).rejects.toThrow(
        'Chat rooms could not be loaded',
      );
      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('chat_rooms');
    });

    it('should surface a room query failure instead of returning fixtures', async () => {
      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [{ room_id: 'room-1', is_locked: false }],
            error: null,
          }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: null, error: { message: 'Room query failed' } }),
        );

      await expect(service.getRooms('user-1')).rejects.toThrow(
        'Chat rooms could not be loaded',
      );
    });
  });

  describe('getSuggestedReplies', () => {
    it('returns only parsed provider suggestions', async () => {
      chatLlmService.generateText.mockResolvedValue(
        '1. Hello there\n- How has your day been?\n• What are you learning?',
      );

      await expect(
        service.getSuggestedReplies('user-1', { recent_messages: [] }),
      ).resolves.toEqual([
        'Hello there',
        'How has your day been?',
        'What are you learning?',
      ]);
    });

    it('surfaces provider failure instead of returning fabricated replies', async () => {
      chatLlmService.generateText.mockRejectedValue(
        new Error('provider unavailable'),
      );

      await expect(
        service.getSuggestedReplies('user-1', { recent_messages: [] }),
      ).rejects.toMatchObject({ status: 503 });
    });

    it('treats an empty provider response as unavailable', async () => {
      chatLlmService.generateText.mockResolvedValue('  \n  ');

      await expect(
        service.getSuggestedReplies('user-1', { recent_messages: [] }),
      ).rejects.toMatchObject({ status: 503 });
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
        ascending: false,
      });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(100);
      expect(mockQueryBuilder.ilike).not.toHaveBeenCalled();
      expect(result).toEqual(messages);
    });

    it('should return the newest window oldest-first so busy rooms keep their latest messages', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: [{ id: 'm3' }, { id: 'm2' }, { id: 'm1' }],
        error: null,
      });

      const result = await service.getMessages('room-1');

      expect(result.map((message) => message.id)).toEqual(['m1', 'm2', 'm3']);
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

    it('should surface a history query failure instead of fabricating messages', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: null,
        error: { message: 'Error' },
      });

      await expect(service.getMessages('room-1')).rejects.toThrow(
        'Failed to load messages: Error',
      );
    });

    it('should return an empty history when the room has no messages', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: [],
        error: null,
      });

      await expect(service.getMessages('room-1')).resolves.toEqual([]);
    });

    describe('pagination', () => {
      beforeEach(() => {
        mockQueryBuilder.lt = vi.fn().mockReturnThis();
      });

      it('should page older history with a strict created_at cursor', async () => {
        mockQueryBuilder.lt.mockResolvedValue({
          data: [{ id: 'm2' }, { id: 'm1' }],
          error: null,
        });

        const result = await service.getMessages(
          'room-1',
          undefined,
          undefined,
          { before: '2026-08-25T12:00:00.123456+00:00', limit: 50 },
        );

        expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
        expect(mockQueryBuilder.lt).toHaveBeenCalledWith(
          'created_at',
          '2026-08-25T12:00:00.123456+00:00',
        );
        expect(result.map((message) => message.id)).toEqual(['m1', 'm2']);
      });

      it('should treat an empty older page as the start of the conversation, never as fixtures', async () => {
        mockQueryBuilder.lt.mockResolvedValue({ data: [], error: null });

        await expect(
          service.getMessages('room-1', undefined, undefined, {
            before: '2026-08-25T12:00:00.000Z',
          }),
        ).resolves.toEqual([]);
      });

      it('should surface a failure while paging instead of looking like the start of the conversation', async () => {
        mockQueryBuilder.lt.mockResolvedValue({
          data: null,
          error: { message: 'timeout' },
        });

        await expect(
          service.getMessages('room-1', undefined, undefined, {
            before: '2026-08-25T12:00:00.000Z',
          }),
        ).rejects.toThrow('Failed to load earlier messages: timeout');
      });

      it.each([
        [500, 100],
        [0, 1],
        [-5, 1],
        [25.9, 25],
        [Number.NaN, 100],
        [undefined, 100],
      ])(
        'should clamp a requested page size of %s to %s',
        async (requested, expected) => {
          mockQueryBuilder.limit.mockResolvedValue({ data: [], error: null });

          await service.getMessages('room-1', undefined, undefined, {
            limit: requested,
          });

          expect(mockQueryBuilder.limit).toHaveBeenCalledWith(expected);
        },
      );

      it('should only seed the greeting on the first page', async () => {
        const seed = vi
          .spyOn(service as any, 'ensureGreetingMessage')
          .mockResolvedValue(undefined);
        // First page ends the chain at limit(); the paged call continues to lt().
        mockQueryBuilder.limit.mockResolvedValueOnce({ data: [], error: null });
        mockQueryBuilder.lt.mockResolvedValue({ data: [], error: null });

        await service.getMessages('room-1', undefined, 'user-1');
        expect(seed).toHaveBeenCalledTimes(1);

        await service.getMessages('room-1', undefined, 'user-1', {
          before: '2026-08-25T12:00:00.000Z',
        });
        expect(seed).toHaveBeenCalledTimes(1);
      });
    });

    describe('room access', () => {
      it('should reject a user who is not a member of an existing room before reading or seeding anything', async () => {
        const seed = vi.spyOn(service as any, 'ensureGreetingMessage');
        mockQueryBuilder.then
          .mockImplementationOnce((resolve: any) =>
            resolve({ data: null, error: null }),
          )
          .mockImplementationOnce((resolve: any) =>
            resolve({ data: { id: 'room-1' }, error: null }),
          );

        await expect(
          service.getMessages('room-1', undefined, 'outsider'),
        ).rejects.toThrow('Not a member of this room');

        expect(mockQueryBuilder.limit).not.toHaveBeenCalled();
        expect(seed).not.toHaveBeenCalled();
      });

      it('should let a member read the room', async () => {
        vi.spyOn(service as any, 'ensureGreetingMessage').mockResolvedValue(
          undefined,
        );
        mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
          resolve({ data: { user_id: 'user-1' }, error: null }),
        );
        mockQueryBuilder.limit.mockResolvedValue({
          data: [{ id: 'm1' }],
          error: null,
        });

        const result = await service.getMessages('room-1', undefined, 'user-1');

        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('room_id', 'room-1');
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
        expect(result).toEqual([{ id: 'm1' }]);
      });

      it('should reject a room id that does not exist instead of exposing fixtures', async () => {
        vi.spyOn(service as any, 'ensureGreetingMessage').mockResolvedValue(
          undefined,
        );
        mockQueryBuilder.then
          .mockImplementationOnce((resolve: any) =>
            resolve({ data: null, error: null }),
          )
          .mockImplementationOnce((resolve: any) =>
            resolve({ data: null, error: null }),
          );
        mockQueryBuilder.limit.mockResolvedValue({ data: [], error: null });

        await expect(
          service.getMessages('missing-room', undefined, 'user-1'),
        ).rejects.toThrow('Chat room not found');

        expect(mockQueryBuilder.limit).not.toHaveBeenCalled();
      });
    });
  });

  describe('getGroupMembers', () => {
    const memberRows = [
      {
        user_id: 'user-1',
        user: {
          id: 'user-1',
          display_name: 'Aiko',
          avatar_url: 'https://cdn/aiko.png',
          native_languages: ['ja', 'en'],
          target_languages: ['en'],
          is_vip: true,
          privacy_hide_vip_status: false,
        },
      },
      {
        user_id: 'user-2',
        user: {
          id: 'user-2',
          display_name: 'Ben',
          avatar_url: null,
          native_languages: null,
          target_languages: null,
          is_vip: true,
          privacy_hide_vip_status: true,
        },
      },
      { user_id: 'user-3', user: null },
    ];

    it('should return the profile fields the chat room needs and respect hidden VIP status', async () => {
      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: { user_id: 'user-1' }, error: null }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: memberRows, error: null }),
        );

      const result = await service.getGroupMembers('room-1', 'user-1');

      expect(result).toEqual([
        {
          user_id: 'user-1',
          user: {
            id: 'user-1',
            display_name: 'Aiko',
            avatar_url: 'https://cdn/aiko.png',
            native_language: 'ja',
            target_languages: ['en'],
            is_vip: true,
          },
        },
        {
          user_id: 'user-2',
          user: {
            id: 'user-2',
            display_name: 'Ben',
            avatar_url: null,
            native_language: null,
            target_languages: [],
            is_vip: false,
          },
        },
        { user_id: 'user-3', user: null },
      ]);
      expect(JSON.stringify(result)).not.toContain('privacy_hide_vip_status');
    });

    it('should only list members to a member of the room', async () => {
      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: null, error: null }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: { id: 'room-1' }, error: null }),
        );

      await expect(
        service.getGroupMembers('room-1', 'outsider'),
      ).rejects.toThrow('Not a member of this room');
    });

    it('should list members for internal callers that pass no user, such as mention notification', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({ data: memberRows, error: null }),
      );

      const result = await service.getGroupMembers('room-1');

      expect(result).toHaveLength(3);
      expect(mockQueryBuilder.eq).not.toHaveBeenCalledWith(
        'user_id',
        expect.anything(),
      );
    });

    it('should fail when the members query fails', async () => {
      mockQueryBuilder.then.mockImplementationOnce((resolve: any) =>
        resolve({ data: null, error: { message: 'boom' } }),
      );

      await expect(service.getGroupMembers('room-1')).rejects.toThrow(
        'Failed to fetch group members',
      );
    });
  });

  describe('createGroup', () => {
    it('creates one room and a deduplicated membership set including the creator', async () => {
      const room = {
        id: 'room-1',
        title: 'Study Group',
        is_online: true,
        is_pinned: false,
        admin_id: 'creator-1',
      };
      const roomBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: room, error: null }),
      };
      const membersBuilder = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
      mockSupabaseClient.from.mockImplementation((table: string) =>
        table === 'chat_rooms' ? roomBuilder : membersBuilder,
      );

      await expect(
        service.createGroup('creator-1', '  Study Group  ', [
          'creator-1',
          'member-1',
          'member-1',
          'member-2',
        ]),
      ).resolves.toBe(room);

      expect(roomBuilder.insert).toHaveBeenCalledWith({
        title: 'Study Group',
        is_online: true,
        is_pinned: false,
        admin_id: 'creator-1',
        labels: [],
      });
      expect(membersBuilder.insert).toHaveBeenCalledWith([
        { room_id: 'room-1', user_id: 'creator-1' },
        { room_id: 'room-1', user_id: 'member-1' },
        { room_id: 'room-1', user_id: 'member-2' },
      ]);
    });

    it('requires at least one member other than the creator', async () => {
      await expect(
        service.createGroup('creator-1', 'Study Group', ['creator-1']),
      ).rejects.toThrow('A group needs at least one other member');

      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('compensates a failed membership insert so no inaccessible room remains', async () => {
      const room = {
        id: 'room-1',
        title: 'Study Group',
        is_online: true,
        is_pinned: false,
        admin_id: 'creator-1',
      };
      const roomBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: room, error: null }),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      const membersBuilder = {
        insert: vi.fn().mockResolvedValue({
          error: { message: 'membership insert failed' },
        }),
      };
      mockSupabaseClient.from.mockImplementation((table: string) =>
        table === 'chat_rooms' ? roomBuilder : membersBuilder,
      );

      await expect(
        service.createGroup('creator-1', 'Study Group', ['member-1']),
      ).rejects.toThrow('Failed to add members to group');

      expect(roomBuilder.delete).toHaveBeenCalledOnce();
      expect(roomBuilder.eq).toHaveBeenCalledWith('id', 'room-1');
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

  describe('group administration', () => {
    const adminRoom = (resolve: any) =>
      resolve({ data: { admin_id: 'admin-1' }, error: null });
    let publishToRoom: Mock;

    beforeEach(() => {
      publishToRoom = (service as any).systemMessageService.publishToRoom;
    });

    describe('renameGroup', () => {
      it('should let the admin rename the group and announce it in the room', async () => {
        mockQueryBuilder.then
          .mockImplementationOnce(adminRoom)
          .mockImplementationOnce((resolve: any) => resolve({ error: null }));

        await service.renameGroup('admin-1', 'room-1', 'Spanish Club');

        expect(mockQueryBuilder.update).toHaveBeenCalledWith({
          title: 'Spanish Club',
        });
        expect(publishToRoom).toHaveBeenCalledWith('room-1', 'groupRenamed', {
          name: 'Spanish Club',
        });
      });

      it('should reject anyone who is not the group admin', async () => {
        mockQueryBuilder.then.mockImplementationOnce(adminRoom);

        await expect(
          service.renameGroup('member-2', 'room-1', 'Hijacked'),
        ).rejects.toThrow('Only group admins can perform this action');

        expect(mockQueryBuilder.update).not.toHaveBeenCalled();
        expect(publishToRoom).not.toHaveBeenCalled();
      });
    });

    describe('addGroupMembers', () => {
      it('should add only new, de-duplicated members and announce the real count', async () => {
        mockQueryBuilder.then
          .mockImplementationOnce(adminRoom)
          .mockImplementationOnce((resolve: any) =>
            resolve({
              data: [{ user_id: 'admin-1' }, { user_id: 'member-2' }],
              error: null,
            }),
          )
          .mockImplementationOnce((resolve: any) => resolve({ error: null }));

        await service.addGroupMembers('admin-1', 'room-1', [
          'member-2',
          'member-3',
          'member-3',
          'member-4',
        ]);

        expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
          [
            { room_id: 'room-1', user_id: 'member-3' },
            { room_id: 'room-1', user_id: 'member-4' },
          ],
          { onConflict: 'room_id,user_id', ignoreDuplicates: true },
        );
        expect(publishToRoom).toHaveBeenCalledWith('room-1', 'memberAdded', {
          count: 2,
        });
      });

      it('should treat a retry that adds nobody new as a successful no-op', async () => {
        mockQueryBuilder.then
          .mockImplementationOnce(adminRoom)
          .mockImplementationOnce((resolve: any) =>
            resolve({
              data: [{ user_id: 'admin-1' }, { user_id: 'member-2' }],
              error: null,
            }),
          );

        await expect(
          service.addGroupMembers('admin-1', 'room-1', ['member-2']),
        ).resolves.toBeUndefined();

        expect(mockQueryBuilder.upsert).not.toHaveBeenCalled();
        expect(publishToRoom).not.toHaveBeenCalled();
      });

      it('should refuse to grow a group past its member cap', async () => {
        const existing = Array.from({ length: 50 }, (_, index) => ({
          user_id: `member-${index}`,
        }));
        mockQueryBuilder.then
          .mockImplementationOnce(adminRoom)
          .mockImplementationOnce((resolve: any) =>
            resolve({ data: existing, error: null }),
          );

        await expect(
          service.addGroupMembers('admin-1', 'room-1', ['new-1', 'new-2']),
        ).rejects.toThrow('A group can have at most 51 members');

        expect(mockQueryBuilder.upsert).not.toHaveBeenCalled();
      });

      it('should reject anyone who is not the group admin', async () => {
        mockQueryBuilder.then.mockImplementationOnce(adminRoom);

        await expect(
          service.addGroupMembers('member-2', 'room-1', ['member-3']),
        ).rejects.toThrow('Only group admins can perform this action');

        expect(mockQueryBuilder.upsert).not.toHaveBeenCalled();
      });

      it('should surface a persistence failure without announcing anything', async () => {
        mockQueryBuilder.then
          .mockImplementationOnce(adminRoom)
          .mockImplementationOnce((resolve: any) =>
            resolve({ data: [{ user_id: 'admin-1' }], error: null }),
          )
          .mockImplementationOnce((resolve: any) =>
            resolve({ error: { message: 'fk violation' } }),
          );

        await expect(
          service.addGroupMembers('admin-1', 'room-1', ['ghost']),
        ).rejects.toThrow('Failed to add members');

        expect(publishToRoom).not.toHaveBeenCalled();
      });
    });

    describe('removeGroupMember', () => {
      it('should remove a member and announce it once', async () => {
        mockQueryBuilder.then
          .mockImplementationOnce(adminRoom)
          .mockImplementationOnce((resolve: any) =>
            resolve({ data: [{ user_id: 'member-2' }], error: null }),
          );

        await service.removeGroupMember('admin-1', 'room-1', 'member-2');

        expect(mockQueryBuilder.match).toHaveBeenCalledWith({
          room_id: 'room-1',
          user_id: 'member-2',
        });
        expect(publishToRoom).toHaveBeenCalledWith(
          'room-1',
          'memberRemoved',
          {},
        );
      });

      it('should never remove the admin, which would orphan the group', async () => {
        mockQueryBuilder.then.mockImplementationOnce(adminRoom);

        await expect(
          service.removeGroupMember('admin-1', 'room-1', 'admin-1'),
        ).rejects.toThrow('The group admin cannot be removed');

        expect(mockQueryBuilder.delete).not.toHaveBeenCalled();
      });

      it('should treat removing someone who already left as a successful no-op', async () => {
        mockQueryBuilder.then
          .mockImplementationOnce(adminRoom)
          .mockImplementationOnce((resolve: any) =>
            resolve({ data: [], error: null }),
          );

        await expect(
          service.removeGroupMember('admin-1', 'room-1', 'member-9'),
        ).resolves.toBeUndefined();

        expect(publishToRoom).not.toHaveBeenCalled();
      });

      it('should reject anyone who is not the group admin', async () => {
        mockQueryBuilder.then.mockImplementationOnce(adminRoom);

        await expect(
          service.removeGroupMember('member-2', 'room-1', 'member-3'),
        ).rejects.toThrow('Only group admins can perform this action');

        expect(mockQueryBuilder.delete).not.toHaveBeenCalled();
      });

      it('should surface a persistence failure', async () => {
        mockQueryBuilder.then
          .mockImplementationOnce(adminRoom)
          .mockImplementationOnce((resolve: any) =>
            resolve({ data: null, error: { message: 'boom' } }),
          );

        await expect(
          service.removeGroupMember('admin-1', 'room-1', 'member-2'),
        ).rejects.toThrow('Failed to remove member');
      });
    });
  });

  describe('read receipts delegation', () => {
    it('receives ReadReceiptsService through dependency injection', async () => {
      // A union-typed constructor parameter erases to `Object` in the emitted
      // decorator metadata, which left Nest injecting `undefined` and every
      // receipt route answering 503. This resolves the service the way the real
      // application does, instead of building ChatService by hand.
      await service.markRoomRead('user-1', 'room-1', ['m1']);

      expect(readReceipts.markRead).toHaveBeenCalledWith('user-1', 'room-1', [
        'm1',
      ]);
    });

    function buildWithReadReceipts(readReceipts: unknown): ChatService {
      return new ChatService(
        { getClient: () => mockSupabaseClient } as any,
        centrifugoService,
        readReceipts as any,
        eventEmitter,
        { getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]) } as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );
    }

    it('should delegate a status update to ReadReceiptsService for the authenticated user', async () => {
      const readReceipts = {
        updateStatus: vi.fn().mockResolvedValue(undefined),
      };

      await buildWithReadReceipts(readReceipts).updateMessageStatus(
        'user-1',
        'msg-1',
        'read',
      );

      expect(readReceipts.updateStatus).toHaveBeenCalledWith(
        'user-1',
        'msg-1',
        'read',
      );
    });

    it('should delegate a bulk room acknowledgement and return the marked count', async () => {
      const readReceipts = {
        markRead: vi.fn().mockResolvedValue({ marked: 2 }),
      };

      await expect(
        buildWithReadReceipts(readReceipts).markRoomRead('user-1', 'room-1', [
          'm1',
          'm2',
        ]),
      ).resolves.toEqual({ marked: 2 });
      expect(readReceipts.markRead).toHaveBeenCalledWith('user-1', 'room-1', [
        'm1',
        'm2',
      ]);
    });

    it('should delegate receipt details for the authenticated user', async () => {
      const status = {
        messageId: 'msg-1',
        deliveryStatus: 'read',
        readBy: [],
        totalMembers: 1,
      };
      const readReceipts = {
        getReceiptStatus: vi.fn().mockResolvedValue(status),
      };

      await expect(
        buildWithReadReceipts(readReceipts).getMessageReceipts(
          'user-1',
          'msg-1',
        ),
      ).resolves.toBe(status);
      expect(readReceipts.getReceiptStatus).toHaveBeenCalledWith(
        'user-1',
        'msg-1',
      );
    });

    it('should report receipts as unavailable instead of silently succeeding when the provider is missing', async () => {
      const unavailable = buildWithReadReceipts(undefined);

      await expect(
        unavailable.updateMessageStatus('user-1', 'msg-1', 'read'),
      ).rejects.toThrow('Read receipts are unavailable');
      await expect(
        unavailable.markRoomRead('user-1', 'room-1', ['m1']),
      ).rejects.toThrow('Read receipts are unavailable');
      await expect(
        unavailable.getMessageReceipts('user-1', 'msg-1'),
      ).rejects.toThrow('Read receipts are unavailable');
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

  describe('getRoomGreeting access control', () => {
    it('should throw ForbiddenException if user is not a member', async () => {
      // assertRoomAccess checks membership first, then room existence
      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: null, error: null }),
        ) // membership missing
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: { id: 'room-1' }, error: null }),
        ); // room exists

      await expect(service.getRoomGreeting('room-1', 'user-1')).rejects.toThrow(
        'Not a member of this room',
      );
    });
  });

  describe('getWallpaper access control', () => {
    it('should throw ForbiddenException if user is not a member', async () => {
      mockQueryBuilder.then
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: null, error: null }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: { id: 'room-1' }, error: null }),
        );

      await expect(service.getWallpaper('room-1', 'user-1')).rejects.toThrow(
        'Not a member of this room',
      );
    });
  });
});
