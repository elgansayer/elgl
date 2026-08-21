import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import type { Mock } from 'vitest';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

describe('Centrifugo connection token contract', () => {
  it('keeps POST /chat/token behind Supabase authentication', () => {
    const controllerPath = Reflect.getMetadata(
      PATH_METADATA,
      ChatController,
    ) as string;
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      ChatController,
    ) as unknown[];
    const handler = ChatController.prototype.getConnectionToken;

    expect(controllerPath).toBe('chat');
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('token');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.POST,
    );
    expect(guards).toContain(SupabaseAuthGuard);
  });

  it('mints a one-hour token whose subject is the authenticated user id', async () => {
    const signJwt = vi.fn().mockResolvedValue('signed-token');
    const service = {
      centrifugoService: { signJwt },
    } as unknown as ChatService;
    const now = Math.floor(Date.now() / 1000);

    const token = await ChatService.prototype.generateConnectionToken.call(
      service,
      'user-123',
    );

    expect(token).toBe('signed-token');
    expect(signJwt).toHaveBeenCalledTimes(1);
    const payload = (signJwt as Mock).mock.calls[0][0] as {
      sub: string;
      exp: number;
    };
    expect(payload.sub).toBe('user-123');
    expect(payload.exp).toBeGreaterThanOrEqual(now + 3600 - 2);
    expect(payload.exp).toBeLessThanOrEqual(now + 3600 + 2);
  });

  it('fails closed when Centrifugo signing fails', async () => {
    const signJwt = vi.fn().mockRejectedValue(new Error('signing unavailable'));
    const service = {
      centrifugoService: { signJwt },
    } as unknown as ChatService;

    await expect(
      ChatService.prototype.generateConnectionToken.call(service, 'user-123'),
    ).rejects.toThrow(
      'Failed to generate Centrifugo token: signing unavailable',
    );
  });
});
