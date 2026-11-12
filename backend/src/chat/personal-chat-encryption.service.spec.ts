import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SupabaseService } from '../supabase/supabase.service';
import { PersonalChatEncryptionService } from './personal-chat-encryption.service';

describe('PersonalChatEncryptionService', () => {
  let service: PersonalChatEncryptionService;
  let mockSupabase: {
    getClient: ReturnType<typeof vi.fn>;
    getRedisClient: ReturnType<typeof vi.fn>;
  };
  let mockRedis: {
    get: ReturnType<typeof vi.fn>;
    setex: ReturnType<typeof vi.fn>;
  };
  let mockConfig: {
    get: ReturnType<typeof vi.fn>;
  };

  const validRoomId = '11111111-2222-4333-8444-555555555555';
  const userA = 'aaaa1111-2222-3333-4444-555555555555';
  const userB = 'bbbb1111-2222-3333-4444-555555555555';
  const userC = 'cccc1111-2222-3333-4444-555555555555';

  beforeEach(async () => {
    mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue('OK'),
    };

    mockConfig = {
      get: vi.fn().mockReturnValue('test-e2ee-secret-key-material-32b!'),
    };

    mockSupabase = {
      getClient: vi.fn(),
      getRedisClient: vi.fn().mockReturnValue(mockRedis),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonalChatEncryptionService,
        {
          provide: SupabaseService,
          useValue: mockSupabase,
        },
        {
          provide: ConfigService,
          useValue: mockConfig,
        },
      ],
    }).compile();

    service = module.get<PersonalChatEncryptionService>(
      PersonalChatEncryptionService,
    );
  });

  describe('assertRoomIdentifier and input validation', () => {
    it('throws BadRequestException on an invalid room ID format', async () => {
      await expect(
        service.getConversationKey('invalid-room-id', userA),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException on an empty user ID', async () => {
      await expect(
        service.getConversationKey(validRoomId, '   '),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getConversationKey authorization and derivation', () => {
    it('returns cached key if Redis session exists and participant is authorised', async () => {
      const cachedKey = 'A'.repeat(43);
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({
          key: cachedKey,
          participants: [userA, userB],
        }),
      );

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: validRoomId, type: 'direct', admin_id: null },
          error: null,
        }),
      };
      const mockMembersBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ user_id: userA }, { user_id: userB }],
          error: null,
        }),
      };
      mockSupabase.getClient.mockReturnValue({
        from: vi.fn((table: string) =>
          table === 'chat_rooms' ? mockQueryBuilder : mockMembersBuilder,
        ),
      });

      const result = await service.getConversationKey(validRoomId, userA);
      expect(result.e2eeKey).toBe(cachedKey);
      expect(result.roomId).toBe(validRoomId);
      expect(result.algorithm).toBe('AES-GCM-256');
      expect(mockSupabase.getClient).toHaveBeenCalledTimes(1);
    });

    it('does not trust cached membership after a participant is removed', async () => {
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({
          key: 'A'.repeat(43),
          participants: [userA, userC].sort(),
        }),
      );

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: validRoomId, type: 'direct', admin_id: null },
          error: null,
        }),
      };
      const mockMembersBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ user_id: userA }, { user_id: userB }],
          error: null,
        }),
      };
      mockSupabase.getClient.mockReturnValue({
        from: vi.fn((table: string) =>
          table === 'chat_rooms' ? mockQueryBuilder : mockMembersBuilder,
        ),
      });

      await expect(
        service.getConversationKey(validRoomId, userC),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('falls back to database when Redis session has an unauthorised participant', async () => {
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({
          key: 'some-key-with-long-length-that-is-valid-base64url',
          participants: [userB, userC],
        }),
      );

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: validRoomId, type: 'direct', admin_id: null },
          error: null,
        }),
      };

      const mockMembersBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ user_id: userA }, { user_id: userB }],
          error: null,
        }),
      };

      mockSupabase.getClient.mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'chat_rooms') return mockQueryBuilder;
          if (table === 'chat_room_members') return mockMembersBuilder;
          return {};
        }),
      });

      const result = await service.getConversationKey(validRoomId, userA);
      expect(result.e2eeKey).toBeDefined();
      expect(result.roomId).toBe(validRoomId);
    });

    it('throws NotFoundException when the chat room does not exist', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabase.getClient.mockReturnValue({
        from: vi.fn(() => mockQueryBuilder),
      });

      await expect(
        service.getConversationKey(validRoomId, userA),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns a distinct unsupported-room error to an authorised group member', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: validRoomId, type: 'group', admin_id: userA },
          error: null,
        }),
      };

      const mockMembersBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ user_id: userA }, { user_id: userB }],
          error: null,
        }),
      };

      mockSupabase.getClient.mockReturnValue({
        from: vi.fn((table: string) =>
          table === 'chat_rooms' ? mockQueryBuilder : mockMembersBuilder,
        ),
      });

      await expect(
        service.getConversationKey(validRoomId, userA),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('does not disclose a group room type to a non-member', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: validRoomId, type: 'group', admin_id: userA },
          error: null,
        }),
      };
      const mockMembersBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ user_id: userA }, { user_id: userB }],
          error: null,
        }),
      };
      mockSupabase.getClient.mockReturnValue({
        from: vi.fn((table: string) =>
          table === 'chat_rooms' ? mockQueryBuilder : mockMembersBuilder,
        ),
      });

      await expect(
        service.getConversationKey(validRoomId, userC),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when the room does not have exactly two members', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: validRoomId, type: 'direct', admin_id: null },
          error: null,
        }),
      };

      const mockMembersBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ user_id: userA }], // Only 1 member
          error: null,
        }),
      };

      mockSupabase.getClient.mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'chat_rooms') return mockQueryBuilder;
          if (table === 'chat_room_members') return mockMembersBuilder;
          return {};
        }),
      });

      await expect(
        service.getConversationKey(validRoomId, userA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when requesting user is not a member of the room', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: validRoomId, type: 'direct', admin_id: null },
          error: null,
        }),
      };

      const mockMembersBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ user_id: userA }, { user_id: userB }],
          error: null,
        }),
      };

      mockSupabase.getClient.mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'chat_rooms') return mockQueryBuilder;
          if (table === 'chat_room_members') return mockMembersBuilder;
          return {};
        }),
      });

      // userC is not in members [userA, userB]
      await expect(
        service.getConversationKey(validRoomId, userC),
      ).rejects.toThrow(ForbiddenException);
    });

    it('generates identical keys for both room participants and caches in Redis', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: validRoomId, type: 'direct', admin_id: null },
          error: null,
        }),
      };

      const mockMembersBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ user_id: userB }, { user_id: userA }], // Unsorted on purpose
          error: null,
        }),
      };

      mockSupabase.getClient.mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'chat_rooms') return mockQueryBuilder;
          if (table === 'chat_room_members') return mockMembersBuilder;
          return {};
        }),
      });

      const resultA = await service.getConversationKey(validRoomId, userA);
      const resultB = await service.getConversationKey(validRoomId, userB);

      expect(resultA.e2eeKey).toBe(resultB.e2eeKey);
      expect(resultA.e2eeKey.length).toBeGreaterThanOrEqual(32);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `chat:e2ee:${validRoomId}`,
        86400,
        expect.stringContaining(resultA.e2eeKey),
      );
    });

    it('fails closed when the dedicated master secret is unavailable', async () => {
      mockConfig.get.mockReturnValue(undefined);
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: validRoomId, type: 'direct', admin_id: null },
          error: null,
        }),
      };
      const mockMembersBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ user_id: userA }, { user_id: userB }],
          error: null,
        }),
      };
      mockSupabase.getClient.mockReturnValue({
        from: vi.fn((table: string) =>
          table === 'chat_rooms' ? mockQueryBuilder : mockMembersBuilder,
        ),
      });

      await expect(
        service.getConversationKey(validRoomId, userA),
      ).rejects.toThrow('Chat encryption service is temporarily unavailable.');
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });
});
