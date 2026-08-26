import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
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
  let centrifugeMock: {
    connect: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-22T12:00:00Z'));
    currentUser.set({
      id: 'user-1',
      user_metadata: { display_name: 'Elgan', avatar_url: '/avatar.png' },
    });
    realtimeCallback = undefined;

    centrifugeMock = {
      connect: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn((_channel: string, callback: (data: unknown) => void) => {
        realtimeCallback = callback;
        return { unsubscribe: vi.fn() };
      }),
      unsubscribe: vi.fn(),
      publish: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        TypingService,
        { provide: CentrifugeService, useValue: centrifugeMock },
        { provide: AuthService, useValue: { currentUser } },
      ],
    });
    service = TestBed.inject(TypingService);
  });

  afterEach(() => {
    service.disconnect();
    vi.useRealTimers();
  });

  it('publishes authenticated typing state to the active room', async () => {
    service.connect('room-1');
    await Promise.resolve();

    service.sendTyping(true);

    expect(centrifugeMock.publish).toHaveBeenCalledWith('chat:room-1:typing', {
      userId: 'user-1',
      displayName: 'Elgan',
      avatarUrl: '/avatar.png',
      typing: true,
      timestamp: Date.now(),
    });
  });

  it('bounds outbound identity metadata and rejects unsafe avatar schemes', async () => {
    currentUser.set({
      id: 'user-1',
      user_metadata: {
        display_name: `  ${'A'.repeat(100)}  `,
        avatar_url: 'javascript:alert(1)',
      },
    });
    service.connect('room-1');
    await Promise.resolve();

    service.sendTyping(true);

    expect(centrifugeMock.publish).toHaveBeenCalledWith(
      'chat:room-1:typing',
      expect.objectContaining({
        displayName: 'A'.repeat(80),
        avatarUrl: '',
      }),
    );
  });

  it('does not publish anonymous typing presence', async () => {
    currentUser.set(null);
    service.connect('room-1');
    await Promise.resolve();

    service.sendTyping(true);

    expect(centrifugeMock.publish).not.toHaveBeenCalled();
  });

  it(
    'throttles repeated start events but always sends stop and allows an immediate restart',
    async () => {
      service.connect('room-1');
      await Promise.resolve();

      service.sendTyping(true);
      service.sendTyping(true);
      expect(centrifugeMock.publish).toHaveBeenCalledTimes(1);

      service.sendTyping(false);
      service.sendTyping(true);

      expect(centrifugeMock.publish).toHaveBeenCalledTimes(3);
      expect(centrifugeMock.publish.mock.calls[1]?.[1]).toMatchObject({ typing: false });
      expect(centrifugeMock.publish.mock.calls[2]?.[1]).toMatchObject({ typing: true });
    },
  );

  it('tracks valid remote typing events and expires them after the timeout', async () => {
    service.connect('room-1');
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
    service.connect('room-1');
    await Promise.resolve();

    realtimeCallback?.({ userId: '', typing: true, timestamp: Date.now() });
    realtimeCallback?.({ userId: 'user-2', typing: 'true', timestamp: Date.now() });
    realtimeCallback?.({ userId: 'user-2', typing: true, timestamp: Number.NaN });
    realtimeCallback?.({ userId: 'user-1', typing: true, timestamp: Date.now() });
    realtimeCallback?.({ userId: 'user-2', typing: true, timestamp: Date.now() - 10_001 });
    realtimeCallback?.({ userId: 'user-3', typing: true, timestamp: Date.now() + 5001 });

    expect(service.typingUsers()).toEqual([]);
  });

  it('bounds remote metadata and drops unsafe avatar URLs', async () => {
    service.connect('room-1');
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
    service.connect('room-1');
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
    service.connect('room-1');
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

    service.connect('room-1');
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

    service.connect('room-1');
    service.connect('room-2');

    first.resolve(undefined);
    await Promise.resolve();
    expect(centrifugeMock.subscribe).not.toHaveBeenCalled();

    second.resolve(undefined);
    await Promise.resolve();
    expect(centrifugeMock.subscribe).toHaveBeenCalledTimes(1);
    expect(centrifugeMock.subscribe).toHaveBeenCalledWith(
      'chat:room-2:typing',
      expect.any(Function),
    );
  });
});
