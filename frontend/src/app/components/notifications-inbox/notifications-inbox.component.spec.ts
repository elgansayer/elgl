import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationsInboxComponent } from './notifications-inbox.component';
import { provideRouter } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { vi } from 'vitest';

describe('NotificationsInboxComponent', () => {
  let component: NotificationsInboxComponent;
  let fixture: ComponentFixture<NotificationsInboxComponent>;
  let mockNotificationService: any;

  beforeEach(async () => {
    mockNotificationService = {
      getNotifications: vi.fn().mockResolvedValue([
        { id: '1', type: 'follow', is_read: false }
      ]),
      getUnreadCount: vi.fn().mockResolvedValue(1),
      markAllAsRead: vi.fn().mockResolvedValue(undefined),
      markAsRead: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [NotificationsInboxComponent],
      providers: [
        provideRouter([]),
        { provide: NotificationService, useValue: mockNotificationService }
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
