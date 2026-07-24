import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationsInboxComponent } from './notifications-inbox.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

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
