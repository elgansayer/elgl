import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { I18nService } from '../../services/i18n.service';
import { InAppNotification, NotificationService } from '../../services/notification.service';
import { UnreadCounterService } from '../../services/unread-counter.service';
import { NotificationsInboxComponent } from './notifications-inbox.component';

function makeNotif(partial: Partial<InAppNotification> = {}): InAppNotification {
  return {
    id: 'd0aa8e62-d334-4d0f-8450-ecb998ed3bf5',
    recipient_id: 'me',
    actor_id: 'u1',
    type: 'like_moment',
    is_read: false,
    created_at: '2026-08-25T10:00:00.000Z',
    ...partial,
  };
}

const initialNotifications = [
  makeNotif({ message: 'liked your moment' }),
  makeNotif({
    id: 'd266b9fa-df93-4869-96bc-e120c8e8fbf0',
    type: 'comment_moment',
    message: 'commented',
    created_at: '2026-08-25T09:00:00.000Z',
  }),
  makeNotif({
    id: '320cd33a-74d4-463d-b74f-8f9ac2610f9e',
    type: 'follow',
    is_read: true,
    created_at: '2026-08-25T08:00:00.000Z',
  }),
];

const mockNotificationService = {
  getNotifications: vi.fn().mockResolvedValue(initialNotifications.map((item) => ({ ...item }))),
  getUnreadCount: vi.fn().mockResolvedValue(5),
  markAllAsRead: vi.fn().mockResolvedValue(undefined),
  markAsRead: vi.fn().mockResolvedValue(undefined),
};

const mockI18nService = {
  translations: vi.fn().mockReturnValue({}),
  translate: (key: string) => key,
};

const mockUnreadCounter = {
  setNotificationUnread: vi.fn(),
  decrementNotificationUnread: vi.fn(),
};

describe('NotificationsInboxComponent', () => {
  let component: NotificationsInboxComponent;
  let fixture: ComponentFixture<NotificationsInboxComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockNotificationService.getNotifications.mockResolvedValue(
      initialNotifications.map((item) => ({ ...item })),
    );
    mockNotificationService.getUnreadCount.mockResolvedValue(5);
    mockNotificationService.markAllAsRead.mockResolvedValue(undefined);
    mockNotificationService.markAsRead.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [NotificationsInboxComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: UnreadCounterService, useValue: mockUnreadCounter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsInboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads a bounded first page and the unread count', () => {
    expect(component.notifications().length).toBe(3);
    expect(component.unreadCount()).toBe(5);
    expect(mockNotificationService.getNotifications).toHaveBeenCalledWith('all', { limit: 20 });
    expect(mockUnreadCounter.setNotificationUnread).toHaveBeenCalledWith(5);
  });

  it('changes tab and resets pagination state', () => {
    component.hasMore.set(true);
    component.additionalNotifications.set([makeNotif({ id: 'extra' })]);
    component.setTab('likes');
    expect(component.selectedTab()).toBe('likes');
    expect(component.additionalNotifications()).toEqual([]);
    expect(component.hasMore()).toBe(false);
  });

  it('marks all read only after persistence succeeds', async () => {
    await component.markAllAsRead();
    expect(component.unreadCount()).toBe(0);
    expect(component.notifications().every((item) => item.is_read)).toBe(true);
    expect(mockUnreadCounter.setNotificationUnread).toHaveBeenCalledWith(0);
  });

  it('keeps unread state and exposes an error when mark-all fails', async () => {
    mockNotificationService.markAllAsRead.mockRejectedValueOnce(new Error('offline'));
    await component.markAllAsRead();
    expect(component.unreadCount()).toBe(5);
    expect(component.actionError()).toBe(true);
  });

  it('loads the next page using the oldest visible timestamp', async () => {
    component.hasMore.set(true);
    mockNotificationService.getNotifications.mockResolvedValueOnce([
      makeNotif({
        id: '56de08f8-3b93-489c-9088-6d861a89b087',
        created_at: '2026-08-25T07:00:00.000Z',
      }),
    ]);

    await component.loadMore();

    expect(mockNotificationService.getNotifications).toHaveBeenLastCalledWith('all', {
      limit: 20,
      before: '2026-08-25T08:00:00.000Z',
    });
    expect(component.notifications().length).toBe(4);
    expect(component.hasMore()).toBe(false);
  });

  it('does not decrement unread state until mark-read succeeds', async () => {
    mockNotificationService.markAsRead.mockRejectedValueOnce(new Error('offline'));
    component.onNotificationClick(component.notifications()[0]);
    await fixture.whenStable();
    expect(component.unreadCount()).toBe(5);
    expect(component.actionError()).toBe(true);
  });

  it('navigates chat notifications to the bounded entity route', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const notification = makeNotif({ type: 'mention_chat', entity_id: 'room-123', is_read: true });
    component.onNotificationClick(notification);
    expect(navigate).toHaveBeenCalledWith(['/chat', 'room-123']);
  });

  it('returns localized activity keys and distinct icons', () => {
    expect(component.getBadgeIcon('like_moment')).toBe('❤️');
    expect(component.getBadgeIcon('mention_chat')).toBe('📣');
    expect(component.getBadgeIcon('follow')).toBe('👤');
    expect(component.getBadgeIcon('system')).toBe('🔔');
    expect(component.getNotificationMessageKey('follow')).toBe('notifications.followedYou');
    expect(component.getNotificationMessageKey('system')).toBe('notifications.systemAlert');
  });

  it('navigates back', () => {
    const location = TestBed.inject(Location);
    const backSpy = vi.spyOn(location, 'back');
    component.goBack();
    expect(backSpy).toHaveBeenCalled();
  });
});
