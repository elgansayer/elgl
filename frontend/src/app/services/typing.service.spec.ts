import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { TypingService } from './typing.service';
import { CentrifugeService } from './centrifuge.service';
import { AuthService } from './auth.service';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe('TypingService', () => {
  let service: TypingService;
  let realtimeCallback: ((data: unknown) => void) | undefined;
  const currentUser = signal<
    | {
        id: string;
        user_metadata: Record<string, string>;
      }
    | null
  >({
    id: 'user-1',
    user_metadata: { display_name: 'Elgan', avatar_url: '/avatar.png' },
  });
  let accessToken: string | null;
  let httpMock: { post: ReturnType<typeof vi.fn> };
  let centrifugeMock: {
    connect: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-22T12:00:00Z'));
    accessToken = 'access-token';
    currentUser.set({
      id: 'user-1',
      user_metadata: { display_name: 'Elgan', avatar_url: '/avatar.png' },
    });
    realtimeCallback = undefined;

    httpMock = {
      post: vi.fn().mockReturnValue(of({ success: true })),
    };
    centrifugeMock = {
      connect: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn((_channel: string, callback: (data: unknown) => void) => {
        realtimeCallback = callback;
        return { unsubscribe: vi.fn() };
      }),
      unsubscribe: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        TypingService,
        { provide: HttpClient, useValue: httpMock },
        { provide: CentrifugeService, useValue: centrifugeMock },
        {
          provide: AuthService,
          useValue: {
            currentUser,
            getAccessToken: () => accessToken,
          },
        },
      ],
    });
    service = TestBed.inject(TypingService);
  });

  afterEach(() => {
    service.disconnect();
    vi.useRealTimers();
  });

  it('publishes authenticated typing state through the membership-checked API', async () => {
    service.connect('550e8400-e29b-41d4-a716-446655440000');
    await Promise.resolve();

    service.sendTyping(true);

    expect(httpMock.post).toHaveBeenCalledWith(
      `${environment.apiUrl}/chat/typing`,
      {
        room_id: '550e8400-e29b-41d4-a716-446655440000',
        is_typing: true,
      },
      { headers: { Authorization: 'Bearer access-token' } },
    );
  });

  it('never sends client-controlled display names or avatar URLs to the typing API', async () => {
    currentUser.set({
      id: 'user-1',
      user_metadata: {
        display_name: '<script>spoofed</script>',
        avatar_url: 'javascript:alert(1)',
      },
    });
    service.connect('550e8400-e29b-41d4-a716-446655440000');
    await Promise.resolve();

    service.sendTyping(true);

    const body = httpMock.post.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body).toEqual({
      room_id: '550e8400-e29b-41d4-a716-446655440000',
      is_typing: true,
    });
    expect(body['userId']).toBeUndefined();
    expect(body['displayName']).toBeUndefined();
    expect(body['avatarUrl']).toBeUndefined();
  });

  it('does not publish anonymous or unauthenticated typing presence', async () => {
    service.connect('550e8400-e29b-41d4-a716-446655440000');
    await Promise.resolve();

    currentUser.set(null);
    service.sendTyping(true);
    currentUser.set({ id: 'user-1', user_metadata: {} });
    accessToken = null;
    service.sendTyping(true);

    expect(httpMock.post).not.toHaveBeenCalled();
  });

  it(
    'throttles repeated start events but always sends stop and allows an immediate restart',
    async () => {
      service.connect('550e8400-e29b-41d4-a716-446655440000');
      await Promise.resolve();

      service.sendTyping(true);
      service.sendTyping(true);
      expect(httpMock.post).toHaveBeenCalledTimes(1);

      service.sendTyping(false);
      service.sendTyping(true);

      expect(httpMock.post).toHaveBeenCalledTimes(3);
      expect(httpMock.post.mock.calls[1]?.[1]).toMatchObject({ is_typing: false });
      expect(httpMock.post.mock.calls[2]?.[1]).toMatchObject({ is_typing: true });
    },
  );

  it('lets composing continue when the ephemeral typing request fails', async () => {
    httpMock.post.mockReturnValueOnce(throwError(() => new Error('offline')));
    service.connect('550e8400-e29b-41d4-a716-446655440000');
    await Promise.resolve();

    expect(() => service.sendTyping(true)).not.toThrow();
    await Promise.resolve();

    expect(httpMock.post).toHaveBeenCalledTimes(1);
  });

  it('tracks valid remote typing events and expires them after the timeout', async () => {
    service.connect('550e8400-e29b-41d4-a716-446655440000');
    await Promise.resolve();

    realtimeCallback?.({
      userId: 'user-2',
      displayName: 'Sawako',
      avatarUrl: '/sawako.png',
      typing: true,
      timestamp: Date.now(),
    });

    expect(service.typingUsers()).toEqual([
      { userId: 'user-2', displayName: 'Sawako', avatarUrl: '/sawako.png' },
    ]);

    vi.advanceTimersByTime(3000);
    expect(service.typingUsers()).toEqual([]);
  });

  it('ignores malformed, anonymous, self, stale, and implausibly future events', async () => {
    service.connect('550e8400-e29b-41d4-a716-446655440000');
    await Promise.resolve();

    realtimeCallback?.({ userId: '', typing: true, timestamp: Date.now() });
    realtimeCallback?.({ userId: 'user-2', typing: 'true', timestamp: Date.now() });
    realtimeCallback?.({ userId: 'user-2', typing: true, timestamp: Number.NaN });
    realtimeCallback?.({ userId: 'user-1', typing: true, timestamp: Date.now() });
    realtimeCallback?.({ userId: ' user-1 ', typing: true, timestamp: Date.now() });
    realtimeCallback?.({ userId: 'user-2', typing: true, timestamp: Date.now() - 10_001 });
    realtimeCallback?.({ userId: 'user-3', typing: true, timestamp: Date.now() + 5001 });

    expect(service.typingUsers()).toEqual([]);
  });

  it('bounds remote metadata and drops unsafe avatar URLs', async () => {
    service.connect('550e8400-e29b-41d4-a716-446655440000');
    await Promise.resolve();

    realtimeCallback?.({
      userId: 'user-2',
      displayName: `  ${'B'.repeat(100)}  `,
      avatarUrl: 'data:image/svg+xml,<svg></svg>',
      typing: true,
      timestamp: Date.now(),
    });

    expect(service.typingUsers()).toEqual([
      { userId: 'user-2', displayName: 'B'.repeat(80), avatarUrl: undefined },
    ]);
  });

  it('caps group typing state to the supported room membership bound', async () => {
    service.connect('550e8400-e29b-41d4-a716-446655440000');
    await Promise.resolve();

    for (let index = 0; index < 25; index += 1) {
      realtimeCallback?.({
        userId: `user-${index + 2}`,
        displayName: `User ${index + 2}`,
        typing: true,
        timestamp: Date.now(),
      });
    }

    expect(service.typingUsers()).toHaveLength(19);
    expect(service.typingUsers()[0]?.userId).toBe('user-8');
    expect(service.typingUsers()[18]?.userId).toBe('user-26');
  });

  it('removes a remote user immediately when a stop event arrives', async () => {
    service.connect('550e8400-e29b-41d4-a716-446655440000');
    await Promise.resolve();

    realtimeCallback?.({
      userId: 'user-2',
      displayName: 'Sawako',
      typing: true,
      timestamp: Date.now(),
    });
    realtimeCallback?.({
      userId: 'user-2',
      displayName: 'Sawako',
      typing: false,
      timestamp: Date.now(),
    });

    expect(service.typingUsers()).toEqual([]);
  });

  it('does not create a stale subscription when connect resolves after disconnect', async () => {
    const pending = deferred<void>();
    centrifugeMock.connect.mockReturnValueOnce(pending.promise);

    service.connect('550e8400-e29b-41d4-a716-446655440000');
    service.disconnect();
    pending.resolve(undefined);
    await Promise.resolve();

    expect(centrifugeMock.subscribe).not.toHaveBeenCalled();
  });

  it('keeps only the newest room subscription during rapid navigation', async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    centrifugeMock.connect
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    service.connect('550e8400-e29b-41d4-a716-446655440000');
    service.connect('550e8400-e29b-41d4-a716-446655440001');

    first.resolve(undefined);
    await Promise.resolve();
    expect(centrifugeMock.subscribe).not.toHaveBeenCalled();

    second.resolve(undefined);
    await Promise.resolve();
    expect(centrifugeMock.subscribe).toHaveBeenCalledTimes(1);
    expect(centrifugeMock.subscribe).toHaveBeenCalledWith(
      'chat:550e8400-e29b-41d4-a716-446655440001:typing',
      expect.any(Function),
    );
  });
});
