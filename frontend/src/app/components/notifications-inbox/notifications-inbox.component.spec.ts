import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Location } from '@angular/common';
import { vi } from 'vitest';
import { NotificationsInboxComponent } from './notifications-inbox.component';
import { NotificationService, InAppNotification } from '../../services/notification.service';
import { I18nService } from '../../services/i18n.service';
import { UnreadCounterService } from '../../services/unread-counter.service';

function makeNotif(partial: Partial<InAppNotification> = {}): InAppNotification {
  return {
    id: '1',
    recipient_id: 'me',
    actor_id: 'u1',
    type: 'like_moment',
    is_read: false,
    created_at: new Date().toISOString(),
    ...partial,
  };
}

const mockNotificationService = {
  getNotifications: vi.fn<(type?: string) => Promise<InAppNotification[]>>().mockResolvedValue([
    makeNotif({ id: '1', type: 'like_moment', message: 'liked your moment' }),
    makeNotif({ id: '2', type: 'comment_moment', message: 'commented' }),
    makeNotif({ id: '3', type: 'follow', is_read: true }),
  ]),
  getUnreadCount: vi.fn<() => Promise<number>>().mockResolvedValue(5),
  markAllAsRead: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  markAsRead: vi.fn<(notificationId: string) => Promise<void>>().mockResolvedValue(undefined),
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
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have initial selectedTab as all', () => {
    expect(component.selectedTab()).toBe('all');
  });

  it('should change tab', () => {
    component.setTab('likes');
    expect(component.selectedTab()).toBe('likes');
  });

  it('should expose filterPills with correct labels', () => {
    const pills = component.filterPills();
    expect(pills.length).toBe(5);
    expect(pills.map((p: { id: string }) => p.id)).toEqual(['all', 'likes', 'comments', 'follows', 'system']);
  });

  it('should mark all notifications as read', async () => {
    await component.markAllAsRead();
    expect(component.unreadCount()).toBe(0);
    expect(mockNotificationService.markAllAsRead).toHaveBeenCalled();
  });

  it('should return correct badge icon', () => {
    expect(component.getBadgeIcon('like_moment')).toBe('❤️');
    expect(component.getBadgeIcon('comment_moment')).toBe('💬');
    expect(component.getBadgeIcon('mention_comment')).toBe('💬');
    expect(component.getBadgeIcon('mention_chat')).toBe('📣');
    expect(component.getBadgeIcon('follow')).toBe('👤');
    expect(component.getBadgeIcon('system')).toBe('🔔');
    expect(component.getBadgeIcon('unknown_type')).toBe('🔔');
  });

  it('should return correct notification message key', () => {
    expect(component.getNotificationMessageKey('follow')).toBe('notifications.followedYou');
    expect(component.getNotificationMessageKey('like_profile')).toBe('notifications.likedProfile');
    expect(component.getNotificationMessageKey('mention_comment')).toBe('notifications.mentionedInComment');
    expect(component.getNotificationMessageKey('mention_chat')).toBe('notifications.mentionedInChat');
    expect(component.getNotificationMessageKey('system')).toBe('notifications.systemAlert');
    expect(component.getNotificationMessageKey('unknown_type')).toBe('notifications.newActivity');
  });

  it('should navigate back on goBack', () => {
    const location = TestBed.inject(Location);
    const backSpy = vi.spyOn(location, 'back');
    component.goBack();
    expect(backSpy).toHaveBeenCalled();
  });
});
