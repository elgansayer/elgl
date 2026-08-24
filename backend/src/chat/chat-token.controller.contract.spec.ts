import type { Mock } from 'vitest';

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
    sanitize: vi.fn((value: string) => value.replace(/<[^>]*>/g, '')),
    setConfig: vi.fn(),
  })),
}));

import type { User } from '@supabase/supabase-js';
import type { Request, Response } from 'express';
import { ChatController } from './chat.controller';
import type { ChatService } from './chat.service';
import type { CentrifugoService } from './centrifugo.service';
import type { ConversationStarterService } from './conversation-starter.service';
import type { TranslationService } from './translation.service';

describe('POST /chat/token contract', () => {
  let chatService: { generateConnectionToken: Mock };
  let centrifugoService: {
    checkConnectionRateLimit: Mock;
    getRateWindowSec: Mock;
  };
  let controller: ChatController;

  beforeEach(() => {
    chatService = {
      generateConnectionToken: vi.fn().mockResolvedValue('signed-token'),
    };
    centrifugoService = {
      checkConnectionRateLimit: vi.fn().mockResolvedValue({
        allowed: true,
        retryAfterMs: 0,
      }),
      getRateWindowSec: vi.fn().mockReturnValue(60),
    };

    controller = new ChatController(
      chatService as unknown as ChatService,
      centrifugoService as unknown as CentrifugoService,
      {} as ConversationStarterService,
      {} as TranslationService,
    );
  });

  function user(): User {
    return { id: 'user-123' } as unknown as User;
  }

  function request(): Request {
    return { ip: '203.0.113.10' } as Request;
  }

  function response(): {
    value: Response;
    status: Mock;
    header: Mock;
    json: Mock;
  } {
    const value = {} as Response;
    const status = vi.fn().mockReturnValue(value);
    const header = vi.fn().mockReturnValue(value);
    const json = vi.fn().mockReturnValue(value);
    Object.assign(value, { status, header, json });
    return { value, status, header, json };
  }

  it('returns a token minted only for the authenticated user', async () => {
    const res = response();

    const result = await controller.getConnectionToken(
      user(),
      request(),
      res.value,
    );

    expect(chatService.generateConnectionToken).toHaveBeenCalledWith(
      'user-123',
    );
    expect(result).toEqual({ token: 'signed-token' });
    expect(res.json).toHaveBeenCalledWith({ token: 'signed-token' });
  });

  it('uses the precise distributed limiter retry time in Retry-After', async () => {
    centrifugoService.checkConnectionRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterMs: 3501,
    });
    const res = response();

    const result = await controller.getConnectionToken(
      user(),
      request(),
      res.value,
    );

    expect(result).toBeNull();
    expect(res.header).toHaveBeenCalledWith('Retry-After', '4');
    expect(res.status).toHaveBeenCalledWith(429);
    expect(chatService.generateConnectionToken).not.toHaveBeenCalled();
  });

  it('falls back to the configured limiter window when retry metadata is unavailable', async () => {
    centrifugoService.checkConnectionRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterMs: 0,
    });
    centrifugoService.getRateWindowSec.mockReturnValue(120);
    const res = response();

    await controller.getConnectionToken(user(), request(), res.value);

    expect(res.header).toHaveBeenCalledWith('Retry-After', '120');
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('fails closed with a stable 503 when token signing throws', async () => {
    chatService.generateConnectionToken.mockRejectedValue(
      new Error('raw signer detail with secret material'),
    );
    const res = response();

    const result = await controller.getConnectionToken(
      user(),
      request(),
      res.value,
    );

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 503,
      message: 'Realtime authentication is temporarily unavailable.',
    });
    expect(JSON.stringify(res.json.mock.calls)).not.toContain(
      'raw signer detail',
    );
  });

  it('never returns an empty connection token as a successful response', async () => {
    chatService.generateConnectionToken.mockResolvedValue('   ');
    const res = response();

    const result = await controller.getConnectionToken(
      user(),
      request(),
      res.value,
    );

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 503,
      message: 'Realtime authentication is temporarily unavailable.',
    });
  });
});
