import { UnauthorizedException } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { DirectConversationController } from './direct-conversation.controller';
import type { DirectConversationService } from './direct-conversation.service';

describe('DirectConversationController', () => {
  const openOrCreate = vi.fn().mockResolvedValue('room-123');
  const controller = new DirectConversationController({
    openOrCreate,
  } as unknown as DirectConversationService);

  it('returns the authoritative room id for an authenticated user', async () => {
    const user = { id: 'user-1' } as User;

    await expect(
      controller.openOrCreate(user, { targetUserId: 'user-2' }),
    ).resolves.toEqual({ roomId: 'room-123' });
    expect(openOrCreate).toHaveBeenCalledWith('user-1', 'user-2');
  });

  it('fails closed when no authenticated user is available', async () => {
    await expect(
      controller.openOrCreate(null, { targetUserId: 'user-2' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
