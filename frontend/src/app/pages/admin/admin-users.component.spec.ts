import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorHandler, signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminUsersComponent } from './admin-users.component';
import { AdminService, AdminUserSummary } from '../../services/admin.service';
import { OfflineAdminStorageService } from '../../services/offline-admin-storage.service';
import { NetworkStatusService } from '../../services/network-status.service';
import { I18nService } from '../../services/i18n.service';
import { CrashReportService } from '../../services/crash-report.service';
import { toastsSignal } from '../../services/toast.service';

describe('AdminUsersComponent', () => {
  let component: AdminUsersComponent;
  let fixture: ComponentFixture<AdminUsersComponent>;
  let onlineSignal: ReturnType<typeof signal<boolean>>;
  let confirmSpy: ReturnType<typeof vi.spyOn>;
  let crashReportService: { reportCrash: ReturnType<typeof vi.fn> };
  let errorHandler: { handleError: ReturnType<typeof vi.fn> };
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
    toastsSignal.set([]);
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    crashReportService = { reportCrash: vi.fn() };
    errorHandler = { handleError: vi.fn() };
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
        {
          provide: I18nService,
          useValue: {
            translate: vi.fn((key: string, params?: Record<string, unknown>) => {
              const name = params?.['name'];
              return name === undefined ? key : `${key}:${String(name)}`;
            }),
          },
        },
        { provide: CrashReportService, useValue: crashReportService },
        { provide: ErrorHandler, useValue: errorHandler },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    confirmSpy.mockRestore();
    toastsSignal.set([]);
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
    expect(fixture.nativeElement.querySelector('[role="dialog"] [role="alert"]')).toBeTruthy();
  });

  it('requires explicit confirmation before banning a user', async () => {
    confirmSpy.mockReturnValueOnce(false);

    await component.banUser(user);

    expect(confirmSpy).toHaveBeenCalledWith('admin.banConfirm:Ada');
    expect(adminService.banUser).not.toHaveBeenCalled();
    expect(component.isBanning()).toBeNull();
  });

  it('shows safe success feedback after a confirmed ban', async () => {
    await component.banUser(user);

    expect(adminService.banUser).toHaveBeenCalledOnce();
    expect(adminService.banUser).toHaveBeenCalledWith(user.id);
    expect(component.isBanning()).toBeNull();
    expect(toastsSignal()).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'success', message: 'admin.userBanned' })]),
    );
  });

  it('keeps warning failures retryable without exposing provider error text', async () => {
    adminService.warnUser.mockRejectedValueOnce(new Error('provider secret: do-not-display'));

    await component.warnUser(user);

    expect(adminService.warnUser).toHaveBeenCalledWith(user.id);
    expect(component.isWarning()).toBeNull();
    expect(toastsSignal()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'error', message: 'admin.warningFailed' }),
      ]),
    );
    expect(toastsSignal().some((toast) => toast.message.includes('do-not-display'))).toBe(false);
    expect(crashReportService.reportCrash).toHaveBeenCalledOnce();
    expect(errorHandler.handleError).toHaveBeenCalledOnce();
  });

  it('serializes warn and ban mutations so conflicting actions cannot overlap', async () => {
    let resolveWarning!: (value: { message: string }) => void;
    adminService.warnUser.mockReturnValueOnce(
      new Promise<{ message: string }>((resolve) => {
        resolveWarning = resolve;
      }),
    );

    const pendingWarning = component.warnUser(user);
    await Promise.resolve();

    expect(component.isWarning()).toBe(user.id);
    await component.banUser(user);
    expect(adminService.banUser).not.toHaveBeenCalled();

    resolveWarning({ message: 'User warned' });
    await pendingWarning;
    expect(component.isWarning()).toBeNull();
  });

  it('fails closed while offline without prompting or mutating moderation state', async () => {
    onlineSignal.set(false);

    await component.warnUser(user);
    await component.banUser(user);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(adminService.warnUser).not.toHaveBeenCalled();
    expect(adminService.banUser).not.toHaveBeenCalled();
  });

  it('renders target-specific names and 44px moderation controls', async () => {
    adminService.listUsers.mockResolvedValueOnce({ users: [user], total: 1, page: 1, pageSize: 10 });
    component.retryUsers();
    await fixture.whenStable();
    fixture.detectChanges();

    const warnButton = fixture.nativeElement.querySelector(
      'button[aria-label="admin.warnUserAria:Ada"]',
    ) as HTMLButtonElement | null;
    const banButton = fixture.nativeElement.querySelector(
      'button[aria-label="admin.banUserAria:Ada"]',
    ) as HTMLButtonElement | null;

    expect(warnButton).toBeTruthy();
    expect(banButton).toBeTruthy();
    expect(warnButton?.classList.contains('min-h-11')).toBe(true);
    expect(banButton?.classList.contains('min-h-11')).toBe(true);
  });
});
