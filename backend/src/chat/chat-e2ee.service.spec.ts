import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatE2eeService } from './chat-e2ee.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('ChatE2eeService', () => {
  let service: ChatE2eeService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  beforeEach(() => {
    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    const supabaseService = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
    } as unknown as SupabaseService;

    service = new ChatE2eeService(supabaseService);
  });

  describe('registerPublicKey', () => {
    it('successfully registers a user public key', async () => {
      mockQueryBuilder.upsert.mockResolvedValueOnce({ error: null });

      const result = await service.registerPublicKey('user-1', {
        public_key: { kty: 'EC', crv: 'P-256', x: 'abc', y: 'def' },
        device_id: 'mobile-1',
      });

      expect(result).toEqual({
        success: true,
        user_id: 'user-1',
        device_id: 'mobile-1',
      });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_e2ee_keys');
    });

    it('rejects registration when user id is blank', async () => {
      await expect(
        service.registerPublicKey('', {
          public_key: { kty: 'EC' },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects registration when public key contains private key parameters', async () => {
      await expect(
        service.registerPublicKey('user-1', {
          public_key: {
            kty: 'EC',
            crv: 'P-256',
            x: 'abc',
            y: 'def',
            d: 'secret-private-key',
          },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects registration when device id exceeds 64 characters', async () => {
      await expect(
        service.registerPublicKey('user-1', {
          public_key: { kty: 'EC' },
          device_id: 'a'.repeat(65),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws ServiceUnavailableException on database error', async () => {
      mockQueryBuilder.upsert.mockResolvedValueOnce({
        error: { message: 'Database connection error' },
      });

      await expect(
        service.registerPublicKey('user-1', {
          public_key: { kty: 'EC' },
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('getPublicKey', () => {
    it('returns the public key when found', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: {
          user_id: 'user-2',
          device_id: 'default',
          public_key: { kty: 'EC', crv: 'P-256' },
        },
        error: null,
      });

      const result = await service.getPublicKey('user-2');
      expect(result).toEqual({
        user_id: 'user-2',
        device_id: 'default',
        public_key: { kty: 'EC', crv: 'P-256' },
      });
    });

    it('throws NotFoundException when no key is found', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(service.getPublicKey('user-2')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws ServiceUnavailableException on storage failure', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Storage timeout' },
      });

      await expect(service.getPublicKey('user-2')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('storeRoomKey', () => {
    it('stores a room key when the user is a member', async () => {
      // First check: membership of calling user
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { room_id: 'room-1' },
        error: null,
      });
      // Upsert room key
      mockQueryBuilder.upsert.mockResolvedValueOnce({ error: null });

      const result = await service.storeRoomKey('user-1', 'room-1', {
        encrypted_key: 'encrypted-secret-key-material',
      });

      expect(result).toEqual({ success: true });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'chat_room_e2ee_keys',
      );
    });

    it('rejects storing key when caller is not a room member', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(
        service.storeRoomKey('outsider', 'room-1', {
          encrypted_key: 'secret',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('validates target user membership when target is specified', async () => {
      // Caller membership: ok
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { room_id: 'room-1' },
        error: null,
      });
      // Target membership: not found
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(
        service.storeRoomKey('user-1', 'room-1', {
          encrypted_key: 'secret',
          target_user_id: 'user-not-in-room',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getRoomKey', () => {
    it('returns the room key when caller is an authorised member', async () => {
      // Membership check
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { room_id: 'room-1' },
        error: null,
      });
      // Key fetch
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: {
          room_id: 'room-1',
          encrypted_key: 'encrypted-room-key-material',
        },
        error: null,
      });

      const result = await service.getRoomKey('user-1', 'room-1');
      expect(result).toEqual({
        room_id: 'room-1',
        encrypted_key: 'encrypted-room-key-material',
      });
    });

    it('forbids retrieval for non-members', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(
        service.getRoomKey('outsider', 'room-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when room key does not exist', async () => {
      // Membership check
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { room_id: 'room-1' },
        error: null,
      });
      // Key fetch: not found
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(
        service.getRoomKey('user-1', 'room-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
