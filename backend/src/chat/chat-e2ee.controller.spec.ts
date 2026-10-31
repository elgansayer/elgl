import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { User } from '@supabase/supabase-js';
import { ChatE2eeController } from './chat-e2ee.controller';
import { ChatE2eeService } from './chat-e2ee.service';

describe('ChatE2eeController', () => {
  let controller: ChatE2eeController;
  let mockE2eeService: {
    registerPublicKey: ReturnType<typeof vi.fn>;
    getPublicKey: ReturnType<typeof vi.fn>;
    storeRoomKey: ReturnType<typeof vi.fn>;
    getRoomKey: ReturnType<typeof vi.fn>;
  };

  const mockUser = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'user@example.com',
  } as User;

  beforeEach(() => {
    mockE2eeService = {
      registerPublicKey: vi.fn(),
      getPublicKey: vi.fn(),
      storeRoomKey: vi.fn(),
      getRoomKey: vi.fn(),
    };

    controller = new ChatE2eeController(
      mockE2eeService as unknown as ChatE2eeService,
    );
  });

  it('delegates public key registration for the authenticated user', async () => {
    mockE2eeService.registerPublicKey.mockResolvedValueOnce({
      success: true,
      user_id: '11111111-1111-4111-8111-111111111111',
      device_id: 'default',
    });

    const dto = {
      public_key: { kty: 'EC', crv: 'P-256' },
      device_id: 'default',
    };
    const result = await controller.registerPublicKey(mockUser, dto);

    expect(result).toEqual({
      success: true,
      user_id: '11111111-1111-4111-8111-111111111111',
      device_id: 'default',
    });
    expect(mockE2eeService.registerPublicKey).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      dto,
    );
  });

  it('rejects unauthenticated public key registration', async () => {
    await expect(
      controller.registerPublicKey(null, { public_key: {} }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('delegates public key lookup by user id', async () => {
    mockE2eeService.getPublicKey.mockResolvedValueOnce({
      user_id: '22222222-2222-4222-8222-222222222222',
      device_id: 'default',
      public_key: { kty: 'EC' },
    });

    const result = await controller.getPublicKey(
      '22222222-2222-4222-8222-222222222222',
      'default',
    );
    expect(result).toEqual({
      user_id: '22222222-2222-4222-8222-222222222222',
      device_id: 'default',
      public_key: { kty: 'EC' },
    });
    expect(mockE2eeService.getPublicKey).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
      'default',
    );
  });

  it('delegates room key storage for the authenticated user', async () => {
    mockE2eeService.storeRoomKey.mockResolvedValueOnce({ success: true });

    const dto = { encrypted_key: 'cipher-key' };
    const result = await controller.storeRoomKey(
      mockUser,
      '33333333-3333-4333-8333-333333333333',
      dto,
    );

    expect(result).toEqual({ success: true });
    expect(mockE2eeService.storeRoomKey).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333',
      dto,
    );
  });

  it('delegates room key retrieval for the authenticated user', async () => {
    mockE2eeService.getRoomKey.mockResolvedValueOnce({
      room_id: '33333333-3333-4333-8333-333333333333',
      encrypted_key: 'cipher-key',
    });

    const result = await controller.getRoomKey(
      mockUser,
      '33333333-3333-4333-8333-333333333333',
    );
    expect(result).toEqual({
      room_id: '33333333-3333-4333-8333-333333333333',
      encrypted_key: 'cipher-key',
    });
    expect(mockE2eeService.getRoomKey).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333',
    );
  });

  it('rejects unauthenticated room key requests', async () => {
    await expect(
      controller.getRoomKey(null, '33333333-3333-4333-8333-333333333333'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
