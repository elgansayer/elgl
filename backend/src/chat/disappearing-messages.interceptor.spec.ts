import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { DisappearingMessagesInterceptor } from './disappearing-messages.interceptor';

function contextFor(url: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ originalUrl: url }),
      getResponse: vi.fn(),
      getNext: vi.fn(),
    }),
  } as unknown as ExecutionContext;
}

function handler(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

describe('DisappearingMessagesInterceptor', () => {
  const interceptor = new DisappearingMessagesInterceptor();

  it('removes expired message-shaped records from chat arrays', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(
        contextFor('/chat/messages/room-1'),
        handler([
          {
            id: 'expired',
            room_id: 'room-1',
            sender_id: 'user-1',
            expires_at: '2000-01-01T00:00:00.000Z',
          },
          {
            id: 'future',
            room_id: 'room-1',
            sender_id: 'user-2',
            expires_at: '2999-01-01T00:00:00.000Z',
          },
          {
            id: 'retained',
            room_id: 'room-1',
            sender_id: 'user-3',
            expires_at: null,
          },
        ]),
      ),
    );

    expect(result).toEqual([
      {
        id: 'future',
        room_id: 'room-1',
        sender_id: 'user-2',
        expires_at: '2999-01-01T00:00:00.000Z',
      },
      {
        id: 'retained',
        room_id: 'room-1',
        sender_id: 'user-3',
        expires_at: null,
      },
    ]);
  });

  it('removes expired messages nested in chat response payloads', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(
        contextFor('/chat/search'),
        handler({
          results: [
            {
              id: 'expired',
              room_id: 'room-1',
              sender_id: 'user-1',
              expires_at: '2000-01-01T00:00:00.000Z',
            },
          ],
        }),
      ),
    );

    expect(result).toEqual({ results: [] });
  });

  it('does not alter non-chat endpoints', async () => {
    const payload = {
      room_id: 'room-1',
      sender_id: 'user-1',
      expires_at: '2000-01-01T00:00:00.000Z',
    };

    const result = await firstValueFrom(
      interceptor.intercept(contextFor('/privacy/status'), handler(payload)),
    );

    expect(result).toBe(payload);
  });

  it('does not treat unrelated expires_at objects as chat messages', async () => {
    const payload = [{ expires_at: '2000-01-01T00:00:00.000Z', token: 'x' }];

    const result = await firstValueFrom(
      interceptor.intercept(contextFor('/chat/token'), handler(payload)),
    );

    expect(result).toEqual(payload);
  });
});
