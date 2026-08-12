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
import { ChatBackupService } from './chat-backup.service';
import { ChatService } from './chat.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('ChatBackupService', () => {
  let service: ChatBackupService;
  let chatServiceMock: { exportChatHistory: Mock };
  let supabaseServiceMock: { getClient: Mock };
  let mockFrom: Mock;

  const userId = 'test-user-id';
  const channelId = 'test-channel-id';

  beforeEach(async () => {
    chatServiceMock = {
      exportChatHistory: vi.fn(),
    };
    supabaseServiceMock = {
      getClient: vi.fn(),
    };
    mockFrom = vi.fn();
    supabaseServiceMock.getClient.mockReturnValue({ from: mockFrom });

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ChatBackupService,
        { provide: ChatService, useValue: chatServiceMock },
        { provide: SupabaseService, useValue: supabaseServiceMock },
      ],
    }).compile();

    service = moduleRef.get<ChatBackupService>(ChatBackupService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('exportChannel', () => {
    it('should delegate to ChatService', async () => {
      const messages = [{ id: 'm1' }] as unknown[];
      chatServiceMock.exportChatHistory.mockResolvedValue(messages);

      await expect(service.exportChannel(userId, channelId)).resolves.toBe(
        messages,
      );
      expect(chatServiceMock.exportChatHistory).toHaveBeenCalledWith(
        userId,
        channelId,
      );
    });
  });

  describe('importChannel', () => {
    it('should reject with ForbiddenException if user is not a member', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      await expect(
        service.importChannel(userId, channelId, []),
      ).rejects.toThrow('You are not a member of this room');
    });

    it('should return 0 when input contains no valid messages', async () => {
      const membershipChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: { user_id: userId }, error: null }),
        insert: vi.fn().mockReturnThis(),
      };
      mockFrom.mockReturnValue(membershipChain);

      const messages = [
        { room_id: 'other' },
        null,
        123,
        { room_id: channelId },
      ];

      const result = await service.importChannel(userId, channelId, messages);
      expect(result).toBe(0);
    });

    it('should insert valid messages and return the inserted count', async () => {
      const membershipChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: { user_id: userId }, error: null }),
      };
      const insertedRows = [{ id: 'm1' }, { id: 'm2' }];
      const insertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: insertedRows, error: null }),
      };
      mockFrom
        .mockReturnValueOnce(membershipChain)
        .mockReturnValueOnce(insertChain);

      const messages = [
        {
          room_id: channelId,
          sender_id: 'sender-1',
          message_type: 'text',
          text_content: 'hello',
          media_url: null,
          reply_to_id: null,
          is_read: true,
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ];

      await expect(
        service.importChannel(userId, channelId, messages),
      ).resolves.toBe(2);
      expect(insertChain.insert).toHaveBeenCalledWith([
        {
          room_id: channelId,
          sender_id: 'sender-1',
          message_type: 'text',
          text_content: 'hello',
          media_url: null,
          correction_payload: null,
          reply_to_id: null,
          correction_request_payload: null,
          status_reply_payload: null,
          is_read: true,
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ]);
      expect(insertChain.select).toHaveBeenCalledWith('id');
    });

    it('should throw BadRequestException when supabase insert fails', async () => {
      const membershipChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: { user_id: userId }, error: null }),
      };
      const insertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi
          .fn()
          .mockResolvedValue({ data: null, error: new Error('DB down') }),
      };
      mockFrom
        .mockReturnValueOnce(membershipChain)
        .mockReturnValueOnce(insertChain);

      const messages = [
        { room_id: channelId, sender_id: 'sender', message_type: 'text' },
      ];

      await expect(
        service.importChannel(userId, channelId, messages),
      ).rejects.toThrow('Failed to restore messages: DB down');
    });
  });
});
