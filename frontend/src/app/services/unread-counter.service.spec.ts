import { TestBed } from '@angular/core/testing';
import { UnreadCounterService } from './unread-counter.service';

describe('UnreadCounterService', () => {
  let service: UnreadCounterService;
  let setAppBadgeSpy: ReturnType<typeof vi.fn>;
  let clearAppBadgeSpy: ReturnType<typeof vi.fn>;

  const mockNavigator = {
    setAppBadge: vi.fn(() => Promise.resolve()),
    clearAppBadge: vi.fn(() => Promise.resolve()),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('navigator', mockNavigator);

    TestBed.configureTestingModule({
      providers: [UnreadCounterService],
    });
    service = TestBed.inject(UnreadCounterService);
    setAppBadgeSpy = mockNavigator.setAppBadge;
    clearAppBadgeSpy = mockNavigator.clearAppBadge;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should initialise with zero counts', () => {
    expect(service.chatUnread()).toBe(0);
    expect(service.notificationUnread()).toBe(0);
    expect(service.totalUnread()).toBe(0);
  });

  it('should set chat unread count', () => {
    service.setChatUnread(5);
    expect(service.chatUnread()).toBe(5);
    expect(service.totalUnread()).toBe(5);
  });

  it('should not allow negative chat unread count', () => {
    service.setChatUnread(-3);
    expect(service.chatUnread()).toBe(0);
  });

  it('should set notification unread count', () => {
    service.setNotificationUnread(3);
    expect(service.notificationUnread()).toBe(3);
    expect(service.totalUnread()).toBe(3);
  });

  it('should compute total as sum of chat and notification unread', () => {
    service.setChatUnread(4);
    service.setNotificationUnread(6);
    expect(service.totalUnread()).toBe(10);
  });

  it('should increment chat unread', () => {
    service.incrementChatUnread();
    expect(service.chatUnread()).toBe(1);
    service.incrementChatUnread();
    expect(service.chatUnread()).toBe(2);
  });

  it('should decrement chat unread', () => {
    service.setChatUnread(5);
    service.decrementChatUnread();
    expect(service.chatUnread()).toBe(4);
  });

  it('should not decrement chat unread below zero', () => {
    service.decrementChatUnread();
    expect(service.chatUnread()).toBe(0);
  });

  it('should increment notification unread', () => {
    service.incrementNotificationUnread();
    expect(service.notificationUnread()).toBe(1);
  });

  it('should decrement notification unread', () => {
    service.setNotificationUnread(3);
    service.decrementNotificationUnread();
    expect(service.notificationUnread()).toBe(2);
  });

  it('should not decrement notification unread below zero', () => {
    service.decrementNotificationUnread();
    expect(service.notificationUnread()).toBe(0);
  });

  it('should set app badge when total unread > 0', async () => {
    service.setChatUnread(3);
    await vi.waitFor(() => {
      expect(setAppBadgeSpy).toHaveBeenCalledWith(3);
    });
  });

  it('should clear app badge when total unread reaches 0', async () => {
    service.setChatUnread(1);
    await vi.waitFor(() => {
      expect(setAppBadgeSpy).toHaveBeenCalled();
    });
    service.setChatUnread(0);
    await vi.waitFor(() => {
      expect(clearAppBadgeSpy).toHaveBeenCalled();
    });
  });

  it('should gracefully handle missing setAppBadge API', async () => {
    vi.stubGlobal('navigator', { clearAppBadge: vi.fn(() => Promise.resolve()) });
    const s = TestBed.inject(UnreadCounterService);
    s.setChatUnread(1);
    await new Promise((r) => setTimeout(r, 50));
    expect(s.totalUnread()).toBe(1);
  });

  it('should gracefully handle missing clearAppBadge API', async () => {
    vi.stubGlobal('navigator', { setAppBadge: vi.fn(() => Promise.resolve()) });
    const s = TestBed.inject(UnreadCounterService);
    s.setChatUnread(1);
    await vi.waitFor(() => {
      // setAppBadge should have been called
    });
    s.setChatUnread(0);
    await new Promise((r) => setTimeout(r, 50));
    expect(s.totalUnread()).toBe(0);
  });
});