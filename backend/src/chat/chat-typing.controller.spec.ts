import { UnauthorizedException } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatTypingController } from './chat-typing.controller';
import { ChatTypingService } from './chat-typing.service';

const roomId = '550e8400-e29b-41d4-a716-446655440000';

describe('ChatTypingController', () => {
  const chatTypingService = {
    publish: vi.fn().mockResolvedValue(undefined),
  };
  let controller: ChatTypingController;

  beforeEach(() => {
    vi.clearAllMocks();
    chatTypingService.publish.mockResolvedValue(undefined);
    controller = new ChatTypingController(
      chatTypingService as unknown as ChatTypingService,
    );
  });

  it('publishes typing for the authenticated Supabase user only', async () => {
    const user = { id: 'user-1' } as User;

    await expect(
      controller.publishTyping(user, { room_id: roomId, is_typing: true }),
    ).resolves.toEqual({ success: true });

    expect(chatTypingService.publish).toHaveBeenCalledWith('user-1', {
      room_id: roomId,
      is_typing: true,
    });
  });

  it('rejects a missing authenticated user', async () => {
    await expect(
      controller.publishTyping(null, { room_id: roomId, is_typing: true }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(chatTypingService.publish).not.toHaveBeenCalled();
  });
});
