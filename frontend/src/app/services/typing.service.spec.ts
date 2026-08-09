import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TypingService } from './typing.service';
import { CentrifugeService } from './centrifuge.service';
import { AuthService } from './auth.service';
import { signal } from '@angular/core';

describe.skip('TypingService', () => {
  let service: TypingService;

  const mockUnsubscribe = vi.fn();
  const mockPublish = vi.fn();
  const mockConnect = vi.fn().mockResolvedValue(undefined);
  let subscribeCallback: ((data: unknown) => void) | null = null;

  const mockCentrifugeService = {
    connect: mockConnect,
    subscribe: vi.fn((_channel: string, cb: (data: unknown) => void) => {
      subscribeCallback = cb;
      return { unsubscribe: mockUnsubscribe };
    }),
    unsubscribe: vi.fn(),
    publish: mockPublish,
  };

  const mockCurrentUser = signal({
    id: 'self',
    display_name: 'Me',
    avatar_url: '/me.png',
  });

  const mockAuthService = {
    currentUser: mockCurrentUser,
  };

  beforeEach(async () => {
    vi.useFakeTimers();

    mockPublish.mockReset();
    mockConnect.mockReset().mockResolvedValue(undefined);
    mockUnsubscribe.mockReset();
    subscribeCallback = null;

    await TestBed.configureTestingModule({
      providers: [
        TypingService,
        { provide: CentrifugeService, useValue: mockCentrifugeService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    service = TestBed.inject(TypingService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start with empty typing users', () => {
    expect(service.typingUsers()).toEqual([]);
  });

  it('should connect to typing channel on connect', async () => {
    service.connect('room1');
    expect(mockConnect).toHaveBeenCalled();
    // Let the promise resolve
    await vi.runAllTimersAsync();
    expect(mockCentrifugeService.subscribe).toHaveBeenCalledWith(
      'chat:room1:typing',
      expect.any(Function),
    );
  });

  it('should not add self to typing users', async () => {
    service.connect('room1');
    await vi.runAllTimersAsync();

    subscribeCallback!({
      userId: 'self',
      displayName: 'Me',
      typing: true,
      timestamp: Date.now(),
    });

    expect(service.typingUsers()).toEqual([]);
  });

  it('should add other user to typing users', async () => {
    service.connect('room1');
    await vi.runAllTimersAsync();

    subscribeCallback!({
      userId: 'other',
      displayName: 'Alice',
      typing: true,
      timestamp: Date.now(),
    });

    expect(service.typingUsers()).toHaveLength(1);
    expect(service.typingUsers()[0].userId).toBe('other');
  });

  it('should remove user after timeout', async () => {
    service.connect('room1');
    await vi.runAllTimersAsync();

    subscribeCallback!({
      userId: 'other',
      displayName: 'Alice',
      typing: true,
      timestamp: Date.now(),
    });

    expect(service.typingUsers()).toHaveLength(1);

    vi.advanceTimersByTime(3500);
    expect(service.typingUsers()).toHaveLength(0);
  });

  it('should throttle publishing typing events', () => {
    service.connect('room1');
    service.sendTyping(true);
    expect(mockPublish).toHaveBeenCalledTimes(1);

    service.sendTyping(true);
    expect(mockPublish).toHaveBeenCalledTimes(1); // throttled

    vi.advanceTimersByTime(2500);
    service.sendTyping(true);
    expect(mockPublish).toHaveBeenCalledTimes(2); // allowed after throttle
  });

  it('should clear users on disconnect', async () => {
    service.connect('room1');
    await vi.runAllTimersAsync();

    subscribeCallback!({
      userId: 'other',
      displayName: 'Alice',
      typing: true,
      timestamp: Date.now(),
    });

    expect(service.typingUsers()).toHaveLength(1);

    service.disconnect();
    expect(service.typingUsers()).toHaveLength(0);
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});