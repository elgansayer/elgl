import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationsInboxComponent } from './notifications-inbox.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NotificationService } from '../../services/notification.service';
import { vi } from 'vitest';

const mockNotificationService = {
  getNotifications: vi.fn().mockResolvedValue([]),
  getUnreadCount: vi.fn().mockResolvedValue(0),
  markAllAsRead: vi.fn().mockResolvedValue(undefined),
  markAsRead: vi.fn().mockResolvedValue(undefined),
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
    // Simulate a non-empty response
    mockNotificationService.getNotifications.mockResolvedValue([{ id: '1', type: 'like_moment', actor_id: 'u1', is_read: false }]);
    mockNotificationService.getUnreadCount.mockResolvedValue(3);
    await component.ngOnInit();
    expect(component.notifications().length).toBeGreaterThan(0);
  });

  it('should filter notifications when tab changes', async () => {
    mockNotificationService.getNotifications.mockResolvedValue([]);
    mockNotificationService.getUnreadCount.mockResolvedValue(0);
    await component.setTab('likes');
    expect(component.selectedTab()).toBe('likes');
  });

  it('should mark all notifications as read', async () => {
    mockNotificationService.markAllAsRead.mockResolvedValue(undefined);
    await component.markAllAsRead();
    expect(component.unreadCount()).toBe(0);
    expect(component.notifications().every((n) => n.is_read)).toBe(true);
  });
});
