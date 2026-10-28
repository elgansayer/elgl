import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TypingService } from './typing.service';
import { CentrifugeService } from './centrifuge.service';
import { AuthService } from './auth.service';
import { ChatService } from './chat.service';

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
  let realtimeCallback: ((data: unknown, meta?: { publisherId?: string }) => void) | undefined;
  const currentUser = signal<{ id: string } | null>({ id: 'user-1' });
  let chatServiceMock: { sendTypingIndicator: ReturnType<typeof vi.fn> };
  let centrifugeMock: {
    connect: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-22T12:00:00Z'));
    currentUser.set({ id: 'user-1' });
    realtimeCallback = undefined;
    chatServiceMock = { sendTypingIndicator: vi.fn().mockResolvedValue(undefined) };

    centrifugeMock = {
      connect: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn((_channel: string, callback: NonNullable<typeof realtimeCallback>) => {
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
        { provide: ChatService, useValue: chatServiceMock },
      ],
    });
    service = TestBed.inject(TypingService);
  });

  afterEach(() => {
    service.disconnect();
    vi.useRealTimers();
  });

  it('asks the API to publish typing state so the server verifies room membership and identity', async () => {
    service.connect('room-1');
    await Promise.resolve();

    service.sendTyping(true);

    expect(chatServiceMock.sendTypingIndicator).toHaveBeenCalledWith('room-1', true);
    // The chat namespace does not accept client publications, so the client never tries.
    expect(centrifugeMock.publish).not.toHaveBeenCalled();
  });

  it('does not send anonymous typing presence', async () => {
    currentUser.set(null);
    service.connect('room-1');
    await Promise.resolve();

    service.sendTyping(true);

    expect(chatServiceMock.sendTypingIndicator).not.toHaveBeenCalled();
  });

  it('does not send typing state before a room is joined or after it is left', async () => {
    service.sendTyping(true);
    expect(chatServiceMock.sendTypingIndicator).not.toHaveBeenCalled();

    service.connect('room-1');
    await Promise.resolve();
    service.disconnect();
    service.sendTyping(true);

    expect(chatServiceMock.sendTypingIndicator).not.toHaveBeenCalled();
  });

  it('throttles repeated start events but always sends stop and allows an immediate restart', async () => {
    service.connect('room-1');
    await Promise.resolve();

    service.sendTyping(true);
    service.sendTyping(true);
    expect(chatServiceMock.sendTypingIndicator).toHaveBeenCalledTimes(1);

    service.sendTyping(false);
    service.sendTyping(true);

    expect(chatServiceMock.sendTypingIndicator.mock.calls).toEqual([
      ['room-1', true],
      ['room-1', false],
      ['room-1', true],
    ]);
  });

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

    // Payload avatars are never surfaced: the room resolves them from its roster.
    expect(service.typingUsers()).toEqual([{ userId: 'user-2', displayName: 'Sawako' }]);

    vi.advanceTimersByTime(3000);
    expect(service.typingUsers()).toEqual([]);
  });

  describe('sender identity and untrusted payloads', () => {
    async function connected(): Promise<void> {
      service.connect('room-1');
      await Promise.resolve();
    }

    it('trusts the server-verified publisher over the identity claimed in the payload', async () => {
      await connected();

      realtimeCallback?.(
        { userId: 'user-2', displayName: 'Sawako', typing: true, timestamp: Date.now() },
        { publisherId: 'user-2' },
      );

      expect(service.typingUsers()).toEqual([{ userId: 'user-2', displayName: 'Sawako' }]);
    });

    it('drops an event whose payload impersonates someone other than the publisher', async () => {
      await connected();

      realtimeCallback?.(
        { userId: 'user-3', displayName: 'Victim', typing: true, timestamp: Date.now() },
        { publisherId: 'user-2' },
      );

      expect(service.typingUsers()).toEqual([]);
    });

    it('identifies the typist from the publisher when the payload names nobody', async () => {
      await connected();

      realtimeCallback?.(
        { displayName: 'Sawako', typing: true, timestamp: Date.now() },
        { publisherId: 'user-2' },
      );

      expect(service.typingUsers().map((user) => user.userId)).toEqual(['user-2']);
    });

    it('ignores the current user echoed back by the publisher id', async () => {
      await connected();

      realtimeCallback?.(
        { displayName: 'Elgan', typing: true, timestamp: Date.now() },
        { publisherId: 'user-1' },
      );

      expect(service.typingUsers()).toEqual([]);
    });

    it('still accepts a server-published event that carries its own identity', async () => {
      await connected();

      realtimeCallback?.({
        userId: 'user-2',
        displayName: 'Sawako',
        typing: true,
        timestamp: Date.now(),
      });

      expect(service.typingUsers()).toHaveLength(1);
    });

    it('sanitises the display name and never keeps an avatar URL from the payload', async () => {
      await connected();

      realtimeCallback?.(
        {
          userId: 'user-2',
          displayName: '  Sa\u0000wa\u202Eko\n\tTanaka  ',
          avatarUrl: 'https://tracker.example/pixel.png',
          typing: true,
          timestamp: Date.now(),
        },
        { publisherId: 'user-2' },
      );

      expect(service.typingUsers()).toEqual([{ userId: 'user-2', displayName: 'Sawako Tanaka' }]);
    });

    it('keeps Persian zero-width joiners in names while capping their length', async () => {
      await connected();
      const persian = 'می\u200Cخواهم';

      realtimeCallback?.(
        { userId: 'user-2', displayName: persian, typing: true, timestamp: Date.now() },
        { publisherId: 'user-2' },
      );
      realtimeCallback?.(
        { userId: 'user-3', displayName: 'x'.repeat(200), typing: true, timestamp: Date.now() },
        { publisherId: 'user-3' },
      );

      expect(service.typingUsers()[0]?.displayName).toBe(persian);
      expect(service.typingUsers()[1]?.displayName).toHaveLength(60);
    });

    it('falls back to an empty name so the UI can show its translated placeholder', async () => {
      await connected();

      realtimeCallback?.(
        { userId: 'user-2', displayName: 42, typing: true, timestamp: Date.now() },
        { publisherId: 'user-2' },
      );

      expect(service.typingUsers()).toEqual([{ userId: 'user-2', displayName: '' }]);
    });

    it('bounds how many typists are tracked when a channel is flooded', async () => {
      await connected();

      for (let index = 0; index < 30; index++) {
        realtimeCallback?.(
          { typing: true, timestamp: Date.now() },
          { publisherId: `flood-${index}` },
        );
      }

      const users = service.typingUsers();
      expect(users).toHaveLength(20);
      expect(users[0]?.userId).toBe('flood-10');
      expect(users.at(-1)?.userId).toBe('flood-29');
    });
  });

  it('ignores malformed, anonymous, and self typing events', async () => {
    service.connect('room-1');
    await Promise.resolve();

    realtimeCallback?.({ userId: '', typing: true, timestamp: Date.now() });
    realtimeCallback?.({ userId: 'user-2', typing: 'true', timestamp: Date.now() });
    realtimeCallback?.({ userId: 'user-2', typing: true, timestamp: Number.NaN });
    realtimeCallback?.({ userId: 'user-1', typing: true, timestamp: Date.now() });

    expect(service.typingUsers()).toEqual([]);
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

  it('removes a desired channel even when no live subscription handle was created', async () => {
    centrifugeMock.subscribe.mockReturnValueOnce(null);

    service.connect('room-1');
    await Promise.resolve();
    service.disconnect();

    expect(centrifugeMock.unsubscribe).toHaveBeenCalledWith('chat:room-1:typing');
  });

  it('keeps only the newest room subscription during rapid navigation', async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    centrifugeMock.connect.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

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
