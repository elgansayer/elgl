import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { NotificationsInboxComponent } from './notifications-inbox.component';
import { NotificationService, InAppNotification } from '../../services/notification.service';
import { I18nService } from '../../services/i18n.service';

const mockNotificationService = {
  getNotifications: vi.fn<(type?: string) => Promise<InAppNotification[]>>().mockResolvedValue([
    {
      id: '1',
      recipient_id: 'me',
      actor_id: 'u1',
      type: 'like_moment',
      message: 'liked your moment',
      is_read: false,
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      recipient_id: 'me',
      actor_id: 'u2',
      type: 'comment_moment',
      message: 'commented',
      is_read: false,
      created_at: new Date().toISOString(),
    },
  ]),
  getUnreadCount: vi.fn<() => Promise<number>>().mockResolvedValue(5),
  markAllAsRead: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  markAsRead: vi.fn<(notificationId: string) => Promise<void>>().mockResolvedValue(undefined),
};

const mockI18nService = {
  translations: vi.fn().mockReturnValue({}),
  translate: (key: string) => key,
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
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsInboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load notifications on init', async () => {
    await component.ngOnInit();
    expect(component.notifications().length).toBeGreaterThan(0);
  });

  it('should filter notifications when tab changes', async () => {
    await component.setTab('likes');
    expect(component.selectedTab()).toBe('likes');
  });

  it('should mark all notifications as read', async () => {
    await component.markAllAsRead();
    expect(component.unreadCount()).toBe(0);
    expect(component.notifications().every((n) => n.is_read)).toBe(true);
  });
});
