import { TestBed } from '@angular/core/testing';
import { UnreadCounterService } from './unread-counter.service';
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

  it('should initialise with zero unread counts', () => {
    expect(service.chatUnread()).toBe(0);
    expect(service.notificationUnread()).toBe(0);
    expect(service.totalUnread()).toBe(0);
  });

  it('should set chat unread count correctly', () => {
    service.setChatUnread(5);
    expect(service.chatUnread()).toBe(5);
    service.setChatUnread(-1);
    expect(service.chatUnread()).toBe(0);
  });

  it('should set notification unread count correctly', () => {
    service.setNotificationUnread(3);
    expect(service.notificationUnread()).toBe(3);
    service.setNotificationUnread(-2);
    expect(service.notificationUnread()).toBe(0);
  });

  it('should increment chat unread', () => {
    service.incrementChatUnread();
    expect(service.chatUnread()).toBe(1);
    service.incrementChatUnread();
    expect(service.chatUnread()).toBe(2);
  });

  it('should decrement chat unread', () => {
    service.setChatUnread(3);
    service.decrementChatUnread();
    expect(service.chatUnread()).toBe(2);
    service.decrementChatUnread();
    service.decrementChatUnread();
    expect(service.chatUnread()).toBe(0);
    service.decrementChatUnread();
    expect(service.chatUnread()).toBe(0);
  });

  it('should increment notification unread', () => {
    service.incrementNotificationUnread();
    expect(service.notificationUnread()).toBe(1);
    service.incrementNotificationUnread();
    expect(service.notificationUnread()).toBe(2);
  });

  it('should decrement notification unread', () => {
    service.setNotificationUnread(2);
    service.decrementNotificationUnread();
    expect(service.notificationUnread()).toBe(1);
    service.decrementNotificationUnread();
    expect(service.notificationUnread()).toBe(0);
    service.decrementNotificationUnread();
    expect(service.notificationUnread()).toBe(0);
  });

  it('should compute total unread as sum of chat and notification', () => {
    service.setChatUnread(3);
    service.setNotificationUnread(5);
    expect(service.totalUnread()).toBe(8);

    service.setChatUnread(0);
    expect(service.totalUnread()).toBe(5);

    service.setNotificationUnread(0);
    expect(service.totalUnread()).toBe(0);
  });

  it('should call setAppBadge when totalUnread is positive', async () => {
    service.setChatUnread(1);
    // Allow effect to run
    await vi.waitFor(() => {
      expect(setAppBadgeSpy).toHaveBeenCalledWith(1);
    }, { timeout: 100 });
  });

  it('should call clearAppBadge when totalUnread becomes zero', async () => {
    service.setNotificationUnread(5);
    await vi.waitFor(() => {
      expect(setAppBadgeSpy).toHaveBeenCalledWith(5);
    }, { timeout: 100 });

    service.setNotificationUnread(0);
    await vi.waitFor(() => {
      expect(clearAppBadgeSpy).toHaveBeenCalled();
    }, { timeout: 100 });
  });

  it('should handle badge update errors gracefully', async () => {
    setAppBadgeSpy.mockRejectedValueOnce(new Error('badge failed'));
    // Should not throw
    service.setChatUnread(3);
    await vi.waitFor(() => {
      expect(setAppBadgeSpy).toHaveBeenCalled();
    }, { timeout: 100 });
  });
});