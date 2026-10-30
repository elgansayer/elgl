import { TestBed } from '@angular/core/testing';
import { UnreadCounterService, NavTab } from './unread-counter.service';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('UnreadCounterService', () => {
  let service: UnreadCounterService;
  let setAppBadgeSpy: ReturnType<typeof vi.fn>;
  let clearAppBadgeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setAppBadgeSpy = vi.fn(() => Promise.resolve());
    clearAppBadgeSpy = vi.fn(() => Promise.resolve());

    Object.defineProperty(navigator, 'setAppBadge', {
      value: setAppBadgeSpy,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'clearAppBadge', {
      value: clearAppBadgeSpy,
      writable: true,
      configurable: true,
    });

    TestBed.configureTestingModule({
      providers: [UnreadCounterService],
    });
    service = TestBed.inject(UnreadCounterService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should initialise all unread counts to zero', () => {
    expect(service.chatUnread()).toBe(0);
    expect(service.momentsUnread()).toBe(0);
    expect(service.discoveryUnread()).toBe(0);
    expect(service.audioRoomsUnread()).toBe(0);
    expect(service.notificationUnread()).toBe(0);
    expect(service.totalUnread()).toBe(0);
  });

  it('should compute totalUnread as sum of all per-tab counts', () => {
    service.set('chat', 3);
    service.set('moments', 1);
    service.set('discovery', 0);
    service.set('audioRooms', 2);
    service.set('profile', 4);
    expect(service.totalUnread()).toBe(10);
  });

  it('should saturate aggregate unread counts at the largest safe integer', () => {
    service.set('chat', Number.MAX_SAFE_INTEGER);
    service.set('moments', Number.MAX_SAFE_INTEGER);

    expect(service.totalUnread()).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('should expose per-tab counts via tabCount', () => {
    service.set('chat', 5);
    service.set('moments', 8);
    expect(service.tabCount('chat')).toBe(5);
    expect(service.tabCount('moments')).toBe(8);
  });

  it('should format compact badge text without losing the underlying count', () => {
    service.set('chat', 100);
    service.set('moments', 12);

    expect(service.badgeText('chat')).toBe('99+');
    expect(service.badgeText('moments')).toBe('12');
    expect(service.tabCount('chat')).toBe(100);
  });

  it('should use the same compact format for the aggregate application badge', () => {
    service.set('chat', 70);
    service.set('moments', 40);

    expect(service.totalUnread()).toBe(110);
    expect(service.totalBadgeText()).toBe('99+');
  });

  it('should handle the full set/increment/decrement lifecycle', () => {
    service.increment('chat');
    service.increment('chat');
    expect(service.chatUnread()).toBe(2);

    service.decrement('chat');
    expect(service.chatUnread()).toBe(1);

    service.decrement('chat');
    service.decrement('chat');
    expect(service.chatUnread()).toBe(0);

    service.increment('discovery');
    service.increment('discovery');
    expect(service.discoveryUnread()).toBe(2);

    service.set('discovery', 100);
    expect(service.discoveryUnread()).toBe(100);
  });

  it('retains realtime increments received after an authoritative request starts', () => {
    service.set('moments', 4);
    const snapshot = service.snapshot();
    service.increment('moments');

    service.reconcile('moments', 7, snapshot);

    expect(service.tabCount('moments')).toBe(8);
  });

  it('retains persisted read deltas received after an authoritative request starts', () => {
    service.set('discovery', 4);
    const snapshot = service.snapshot();
    service.decrement('discovery');

    service.reconcile('discovery', 4, snapshot);

    expect(service.tabCount('discovery')).toBe(3);
  });

  it('should normalise invalid and fractional counts before navigation renders them', () => {
    service.set('chat', Number.NaN);
    service.set('moments', Number.POSITIVE_INFINITY);
    service.set('discovery', -2);
    service.set('audioRooms', 7.9);

    expect(service.tabCount('chat')).toBe(0);
    expect(service.tabCount('moments')).toBe(0);
    expect(service.tabCount('discovery')).toBe(0);
    expect(service.tabCount('audioRooms')).toBe(7);
    expect(service.badgeText('audioRooms')).toBe('7');
  });

  it('should saturate increments at the largest safe integer', () => {
    service.set('profile', Number.MAX_SAFE_INTEGER);
    service.increment('profile');
    expect(service.tabCount('profile')).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('should support legacy method names', () => {
    service.setChatUnread(7);
    expect(service.chatUnread()).toBe(7);

    service.incrementChatUnread();
    expect(service.chatUnread()).toBe(8);

    service.decrementChatUnread();
    expect(service.chatUnread()).toBe(7);

    service.setNotificationUnread(3);
    expect(service.notificationUnread()).toBe(3);

    service.incrementNotificationUnread();
    expect(service.notificationUnread()).toBe(4);

    service.decrementNotificationUnread();
    expect(service.notificationUnread()).toBe(3);
  });

  it('should reset all counts to zero', () => {
    service.set('chat', 5);
    service.set('moments', 3);
    service.set('profile', 1);
    service.resetAll();
    expect(service.totalUnread()).toBe(0);
    const tabs: NavTab[] = ['chat', 'moments', 'discovery', 'audioRooms', 'profile'];
    for (const tab of tabs) {
      expect(service.tabCount(tab)).toBe(0);
    }
  });

  it('should not allow negative counts via set', () => {
    service.set('chat', -5);
    expect(service.chatUnread()).toBe(0);
  });

  it('should not allow negative counts via decrement', () => {
    service.decrement('chat');
    expect(service.chatUnread()).toBe(0);
  });

  it('should call setAppBadge when totalUnread is positive', async () => {
    service.set('chat', 1);
    await vi.waitFor(
      () => {
        expect(setAppBadgeSpy).toHaveBeenCalledWith(1);
      },
      { timeout: 100 },
    );
  });

  it('should call clearAppBadge when totalUnread becomes zero', async () => {
    service.set('profile', 5);
    await vi.waitFor(
      () => {
        expect(setAppBadgeSpy).toHaveBeenCalledWith(5);
      },
      { timeout: 100 },
    );

    service.set('profile', 0);
    await vi.waitFor(
      () => {
        expect(clearAppBadgeSpy).toHaveBeenCalled();
      },
      { timeout: 100 },
    );
  });

  it('should handle badge update errors gracefully', async () => {
    setAppBadgeSpy.mockRejectedValueOnce(new Error('badge failed'));
    service.set('chat', 3);
    await vi.waitFor(
      () => {
        expect(setAppBadgeSpy).toHaveBeenCalled();
      },
      { timeout: 100 },
    );
  });

  it('should support setCount as an alias for set', () => {
    service.setCount('chat', 5);
    expect(service.chatUnread()).toBe(5);
    service.setCount('moments', -1);
    expect(service.momentsUnread()).toBe(0);
  });

  it('should expose get as an alias for tabCount', () => {
    service.set('discovery', 4);
    expect(service.get('discovery')).toBe(4);
  });

  it('should support resetting a single tab or all tabs', () => {
    service.set('chat', 5);
    service.set('moments', 3);
    service.set('discovery', 2);

    service.reset('moments');
    expect(service.chatUnread()).toBe(5);
    expect(service.momentsUnread()).toBe(0);
    expect(service.discoveryUnread()).toBe(2);

    service.reset();
    expect(service.chatUnread()).toBe(0);
    expect(service.momentsUnread()).toBe(0);
    expect(service.discoveryUnread()).toBe(0);
  });

  it('should safely swallow synchronous exceptions from navigator.setAppBadge', () => {
    setAppBadgeSpy.mockImplementation(() => {
      throw new Error('SecurityError: blocked by permissions policy');
    });

    expect(() => service.set('chat', 2)).not.toThrow();
  });

  it('should safely swallow synchronous exceptions from navigator.clearAppBadge', () => {
    service.set('chat', 2);
    clearAppBadgeSpy.mockImplementation(() => {
      throw new Error('SecurityError: blocked by permissions policy');
    });

    expect(() => service.set('chat', 0)).not.toThrow();
  });

  it('should ignore non-callable setAppBadge properties on navigator', () => {
    Object.defineProperty(navigator, 'setAppBadge', {
      value: 'not-a-function',
      writable: true,
      configurable: true,
    });

    expect(() => service.set('chat', 1)).not.toThrow();
  });

  it('should ignore non-callable clearAppBadge properties on navigator', () => {
    service.set('chat', 1);
    Object.defineProperty(navigator, 'clearAppBadge', {
      value: true,
      writable: true,
      configurable: true,
    });

    expect(() => service.set('chat', 0)).not.toThrow();
  });
});
