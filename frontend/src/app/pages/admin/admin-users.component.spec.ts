import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { AdminUsersComponent } from './admin-users.component';
import { AdminService, AdminUserSummary } from '../../services/admin.service';
import { OfflineAdminStorageService } from '../../services/offline-admin-storage.service';
import { NetworkStatusService } from '../../services/network-status.service';
import { I18nService } from '../../services/i18n.service';

describe('AdminUsersComponent', () => {
  let component: AdminUsersComponent;
  let fixture: ComponentFixture<AdminUsersComponent>;
  let onlineSignal: ReturnType<typeof signal<boolean>>;
  let adminService: {
    listUsers: ReturnType<typeof vi.fn>;
    getLoginHistory: ReturnType<typeof vi.fn>;
    setVipStatus: ReturnType<typeof vi.fn>;
    banUser: ReturnType<typeof vi.fn>;
    warnUser: ReturnType<typeof vi.fn>;
  };

  const user: AdminUserSummary = {
    id: 'user-1',
    display_name: 'Ada',
    native_languages: ['en'],
    target_languages: ['es'],
    is_vip: false,
    vip_tier: 'free',
    is_admin: false,
    coins_balance: 10,
    study_streak_days: 2,
    created_at: '2026-08-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    onlineSignal = signal(true);
    adminService = {
      listUsers: vi.fn().mockResolvedValue({ users: [], total: 0, page: 1, pageSize: 10 }),
      getLoginHistory: vi.fn().mockResolvedValue([]),
      setVipStatus: vi.fn().mockResolvedValue({}),
      banUser: vi.fn().mockResolvedValue({ message: 'User banned' }),
      warnUser: vi.fn().mockResolvedValue({ message: 'User warned' }),
    };

    await TestBed.configureTestingModule({
      imports: [AdminUsersComponent],
      providers: [
        { provide: AdminService, useValue: adminService },
        {
          provide: OfflineAdminStorageService,
          useValue: {
            isOnline: onlineSignal.asReadonly(),
            cachedDataAvailable: signal(false).asReadonly(),
            cacheUsers: vi.fn(),
            getCachedUsers: vi.fn().mockResolvedValue(null),
            cacheLoginHistory: vi.fn(),
            getCachedLoginHistory: vi.fn().mockResolvedValue(null),
          },
        },
        { provide: NetworkStatusService, useValue: { isOnline: onlineSignal.asReadonly() } },
        { provide: I18nService, useValue: { translate: vi.fn((k: string) => k) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show offline banner when offline', () => {
    onlineSignal.set(false);
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('app-admin-offline-banner');
    expect(banner).toBeTruthy();
  });

  it('surfaces a retryable error instead of an empty user list when loading fails', async () => {
    adminService.listUsers.mockRejectedValueOnce(new Error('network unavailable'));

    component.retryUsers();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.usersLoadError()).toBe(true);
    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
    expect(adminService.listUsers).toHaveBeenCalledTimes(2);
  });

  it('distinguishes login-history failures from a real empty history', async () => {
    adminService.getLoginHistory.mockRejectedValueOnce(new Error('network unavailable'));

    component.openHistory(user);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.historyLoadError()).toBe(true);
    expect(component.loginHistory()).toEqual([]);
    expect(fixture.nativeElement.querySelector('[role="dialog"] app-empty-state')).toBeTruthy();
  });
});
