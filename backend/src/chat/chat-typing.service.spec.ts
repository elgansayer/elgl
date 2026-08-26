import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { describe, beforeEach, expect, it, vi } from 'vitest';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from './centrifugo.service';
import { ChatTypingService } from './chat-typing.service';

function createBuilder(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
}

describe('ChatTypingService', () => {
  const roomId = '550e8400-e29b-41d4-a716-446655440000';
  const membershipBuilder = createBuilder({
    data: { user_id: 'user-1' },
    error: null,
  });
  const profileBuilder = createBuilder({
    data: {
      display_name: ' Alice ',
      avatar_url: 'https://example.com/alice.png',
    },
    error: null,
  });
  const supabaseClient = {
    from: vi.fn((table: string) => {
      if (table === 'chat_room_members') return membershipBuilder;
      if (table === 'users') return profileBuilder;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
  const supabaseService = {
    getClient: vi.fn(() => supabaseClient),
  };
  const centrifugoService = {
    publish: vi.fn().mockResolvedValue(undefined),
  };
  let service: ChatTypingService;

  beforeEach(() => {
    vi.clearAllMocks();
    membershipBuilder.maybeSingle.mockResolvedValue({
      data: { user_id: 'user-1' },
      error: null,
    });
    profileBuilder.maybeSingle.mockResolvedValue({
      data: {
        display_name: ' Alice ',
        avatar_url: 'https://example.com/alice.png',
      },
      error: null,
    });
    centrifugoService.publish.mockResolvedValue(undefined);
    service = new ChatTypingService(
      supabaseService as unknown as SupabaseService,
      centrifugoService as unknown as CentrifugoService,
    );
  });

  it('verifies membership and publishes server-owned identity metadata', async () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1_777_000_000_000);

    await service.publish('user-1', { room_id: roomId, is_typing: true });

    expect(supabaseClient.from).toHaveBeenCalledWith('chat_room_members');
    expect(membershipBuilder.eq).toHaveBeenNthCalledWith(1, 'room_id', roomId);
    expect(membershipBuilder.eq).toHaveBeenNthCalledWith(
      2,
      'user_id',
      'user-1',
    );
    expect(centrifugoService.publish).toHaveBeenCalledWith(
      `chat:${roomId}:typing`,
      {
        userId: 'user-1',
        displayName: 'Alice',
        avatarUrl: 'https://example.com/alice.png',
        typing: true,
        timestamp: 1_777_000_000_000,
      },
    );
  });

  it('rejects users who are not members of the requested room', async () => {
    membershipBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(
      service.publish('user-1', { room_id: roomId, is_typing: true }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(centrifugoService.publish).not.toHaveBeenCalled();
  });

  it('fails closed when membership verification is unavailable', async () => {
    membershipBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'database offline' },
    });

    await expect(
      service.publish('user-1', { room_id: roomId, is_typing: true }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(centrifugoService.publish).not.toHaveBeenCalled();
  });

  it('returns a stable failure when membership verification rejects', async () => {
    membershipBuilder.maybeSingle.mockRejectedValueOnce(
      new Error('secret database detail'),
    );

    await expect(
      service.publish('user-1', { room_id: roomId, is_typing: true }),
    ).rejects.toEqual(
      new ServiceUnavailableException('Typing presence is unavailable.'),
    );
    expect(centrifugoService.publish).not.toHaveBeenCalled();
  });

  it('bounds display names and strips unsafe profile avatar URLs', async () => {
    profileBuilder.maybeSingle.mockResolvedValueOnce({
      data: {
        display_name: ` ${'A'.repeat(100)} `,
        avatar_url: 'javascript:alert(1)',
      },
      error: null,
    });

    await service.publish('user-1', { room_id: roomId, is_typing: false });

    expect(centrifugoService.publish).toHaveBeenCalledWith(
      `chat:${roomId}:typing`,
      expect.objectContaining({
        displayName: 'A'.repeat(80),
        avatarUrl: '',
        typing: false,
      }),
    );
  });

  it('degrades profile lookup failures without exposing provider errors', async () => {
    profileBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'profile lookup failed' },
    });

    await service.publish('user-1', { room_id: roomId, is_typing: true });

    expect(centrifugoService.publish).toHaveBeenCalledWith(
      `chat:${roomId}:typing`,
      expect.objectContaining({ displayName: 'Someone', avatarUrl: '' }),
    );
  });

  it('degrades rejected profile lookups without blocking publication', async () => {
    profileBuilder.maybeSingle.mockRejectedValueOnce(
      new Error('secret database detail'),
    );

    await service.publish('user-1', { room_id: roomId, is_typing: true });

    expect(centrifugoService.publish).toHaveBeenCalledWith(
      `chat:${roomId}:typing`,
      expect.objectContaining({ displayName: 'Someone', avatarUrl: '' }),
    );
  });

  it('returns a stable service-unavailable failure when realtime publish fails', async () => {
    centrifugoService.publish.mockRejectedValueOnce(
      new Error('secret provider detail'),
    );

    await expect(
      service.publish('user-1', { room_id: roomId, is_typing: true }),
    ).rejects.toEqual(
      new ServiceUnavailableException('Typing presence is unavailable.'),
    );
  });
});
