import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ChatPinsService } from './chat-pins.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('ChatPinsService', () => {
  let service: ChatPinsService;
  let mockFrom: Mock;
  const userId = '11111111-1111-4111-8111-111111111111';
  const roomId = '22222222-2222-4222-8222-222222222222';

  beforeEach(async () => {
    mockFrom = vi.fn();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ChatPinsService,
        {
          provide: SupabaseService,
          useValue: { getClient: vi.fn(() => ({ from: mockFrom })) },
        },
      ],
    }).compile();
    service = moduleRef.get(ChatPinsService);
  });

  afterEach(() => vi.clearAllMocks());

  it('returns only the authenticated users pinned room ids', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [{ room_id: roomId }, { room_id: 'room-2' }, { room_id: null }],
        error: null,
      }),
    };
    mockFrom.mockReturnValue(chain);

    await expect(service.getPinnedRoomIds(userId)).resolves.toEqual([roomId, 'room-2']);
    expect(mockFrom).toHaveBeenCalledWith('chat_room_pins');
    expect(chain.eq).toHaveBeenCalledWith('user_id', userId);
    expect(chain.limit).toHaveBeenCalledWith(100);
  });

  it('fails closed when pin state cannot be loaded', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: new Error('database unavailable') }),
    };
    mockFrom.mockReturnValue(chain);

    await expect(service.getPinnedRoomIds(userId)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('idempotently pins a room after membership verification', async () => {
    const membership = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { room_id: roomId }, error: null }),
    };
    const pins = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };
    mockFrom.mockImplementation((table: string) =>
      table === 'chat_room_members' ? membership : pins,
    );

    await expect(service.setPinned(userId, roomId, true)).resolves.toEqual({
      room_id: roomId,
      is_pinned: true,
    });
    expect(pins.upsert).toHaveBeenCalledWith(
      { user_id: userId, room_id: roomId },
      { onConflict: 'user_id,room_id', ignoreDuplicates: true },
    );
  });

  it('rejects pin mutations for non-members without exposing room membership', async () => {
    const membership = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockFrom.mockReturnValue(membership);

    await expect(service.setPinned(userId, roomId, true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('unpins idempotently and scopes deletion to the authenticated user and room', async () => {
    const membership = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { room_id: roomId }, error: null }),
    };
    const deleteChain = {
      eq: vi.fn(),
    };
    deleteChain.eq
      .mockReturnValueOnce(deleteChain)
      .mockResolvedValueOnce({ error: null });
    const pins = {
      delete: vi.fn().mockReturnValue(deleteChain),
    };
    mockFrom.mockImplementation((table: string) =>
      table === 'chat_room_members' ? membership : pins,
    );

    await expect(service.setPinned(userId, roomId, false)).resolves.toEqual({
      room_id: roomId,
      is_pinned: false,
    });
    expect(deleteChain.eq).toHaveBeenNthCalledWith(1, 'user_id', userId);
    expect(deleteChain.eq).toHaveBeenNthCalledWith(2, 'room_id', roomId);
  });
});
