import type { Mock } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ChatBackupService } from './chat-backup.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  MAX_IMPORT_MESSAGES,
  MAX_IMPORT_PAYLOAD_BYTES,
} from './dto/import-chat-backup.dto';

const ROOM_ID = '11111111-2222-4333-8444-555555555555';
const USER_ID = '99999999-8888-4777-8666-555555555555';

describe('ChatBackupService', () => {
  let service: ChatBackupService;
  let supabaseService: { getClient: Mock };
  let membershipQuery: { maybeSingle: Mock };
  let messagesQuery: { order: Mock; insert: Mock };

  const client = () => ({
    from: vi.fn((table: string) => {
      if (table === 'chat_room_members') {
        return { select: vi.fn(() => membershipQuery) };
      }
      if (table === 'chat_messages') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => messagesQuery) })),
          insert: messagesQuery.insert,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  });

  beforeEach(async () => {
    membershipQuery = {
      eq: vi.fn(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { room_id: ROOM_ID }, error: null }),
    };
    (membershipQuery.eq as Mock).mockReturnValue(membershipQuery);
    messagesQuery = {
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn(() => ({ select: vi.fn() })),
    };

    supabaseService = {
      getClient: vi.fn(() => client()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatBackupService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    }).compile();

    service = module.get<ChatBackupService>(ChatBackupService);
    vi.spyOn(service['logger'], 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('exportRoomBackup', () => {
    it('exports a room document for a member', async () => {
      const messages = [
        {
          message_type: 'text',
          text_content: 'hola',
          media_url: null,
          correction_payload: null,
          sender_id: USER_ID,
          created_at: '2026-11-01T10:00:00.000Z',
        },
      ];
      messagesQuery.order.mockResolvedValue({ data: messages, error: null });

      const result = await service.exportRoomBackup(USER_ID, ROOM_ID);

      expect(membershipQuery.maybeSingle).toHaveBeenCalled();
      expect(result.room_id).toBe(ROOM_ID);
      expect(result.messages).toEqual(messages);
      expect(typeof result.exported_at).toBe('string');
      expect(messagesQuery.order).toHaveBeenCalledWith('created_at', {
        ascending: true,
      });
    });

    it('rejects a non-member before reading any message', async () => {
      membershipQuery.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(service.exportRoomBackup(USER_ID, ROOM_ID)).rejects.toThrow(
        ForbiddenException,
      );
      expect(messagesQuery.order).not.toHaveBeenCalled();
    });

    it('rejects when membership cannot be verified', async () => {
      membershipQuery.maybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'membership lookup failed' },
      });

      await expect(service.exportRoomBackup(USER_ID, ROOM_ID)).rejects.toThrow(
        'You are not a member of this chat room',
      );
    });

    it('fails without leaking provider details when the export query fails', async () => {
      messagesQuery.order.mockResolvedValue({
        data: null,
        error: { message: 'column room_id does not exist' },
      });

      await expect(service.exportRoomBackup(USER_ID, ROOM_ID)).rejects.toThrow(
        'Failed to export chat backup',
      );
      expect(service['logger'].error).toHaveBeenCalledWith(
        'Export failed for room 11111111-2222-4333-8444-555555555555: column room_id does not exist',
      );
    });
  });

  describe('importRoomBackup', () => {
    const insertChain = (response: {
      data: unknown;
      error: null | { message: string };
    }) => {
      const select = vi.fn().mockResolvedValue(response);
      messagesQuery.insert.mockReturnValue({ select });
      return select;
    };

    it('imports a bounded payload as the caller', async () => {
      insertChain({ data: [{ id: 'new-1' }, { id: 'new-2' }], error: null });

      const count = await service.importRoomBackup(USER_ID, ROOM_ID, [
        {
          message_type: 'text',
          text_content: 'hello',
          sender_id: 'someone-else',
          created_at: '2026-11-01T10:00:00.000Z',
        },
        { text_content: 'world' },
      ]);

      expect(count).toBe(2);
      expect(messagesQuery.insert).toHaveBeenCalledWith([
        {
          room_id: ROOM_ID,
          sender_id: USER_ID,
          message_type: 'text',
          text_content: 'hello',
          media_url: null,
          correction_payload: null,
          created_at: '2026-11-01T10:00:00.000Z',
        },
        {
          room_id: ROOM_ID,
          sender_id: USER_ID,
          message_type: 'text',
          text_content: 'world',
          media_url: null,
          correction_payload: null,
          created_at: expect.any(String),
        },
      ]);
    });

    it('rejects an oversized payload before inserting', async () => {
      const oversized = [
        {
          text_content: 'x'.repeat(MAX_IMPORT_PAYLOAD_BYTES),
        },
      ];

      await expect(
        service.importRoomBackup(USER_ID, ROOM_ID, oversized),
      ).rejects.toThrow(BadRequestException);
      expect(messagesQuery.insert).not.toHaveBeenCalled();
    });

    it('rejects more messages than the import bound allows', async () => {
      const tooMany = Array.from({ length: MAX_IMPORT_MESSAGES + 1 }, () => ({
        text_content: 'a',
      }));

      await expect(
        service.importRoomBackup(USER_ID, ROOM_ID, tooMany),
      ).rejects.toThrow(`messages must contain at most ${MAX_IMPORT_MESSAGES}`);
      expect(messagesQuery.insert).not.toHaveBeenCalled();
    });

    it('rejects a non-member before inserting', async () => {
      membershipQuery.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(
        service.importRoomBackup(USER_ID, ROOM_ID, [{ text_content: 'hi' }]),
      ).rejects.toThrow(ForbiddenException);
      expect(messagesQuery.insert).not.toHaveBeenCalled();
    });

    it('fails without leaking provider details when the insert fails', async () => {
      insertChain({
        data: null,
        error: { message: 'relation does not exist' },
      });

      await expect(
        service.importRoomBackup(USER_ID, ROOM_ID, [{ text_content: 'hi' }]),
      ).rejects.toThrow('Failed to import chat backup');
      expect(service['logger'].error).toHaveBeenCalledWith(
        'Import failed for room 11111111-2222-4333-8444-555555555555: relation does not exist',
      );
    });
  });
});
