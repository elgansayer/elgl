import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { AdminPortalComponent } from './admin-portal.component';
import { AdminService, AdminUserSummary } from '../../services/admin.service';
import { I18nService } from '../../services/i18n.service';
import { toastsSignal } from '../../services/toast.service';

describe('AdminPortalComponent', () => {
  let component: AdminPortalComponent;
  let fixture: ComponentFixture<AdminPortalComponent>;
  let mockAdminService: {
    listUsers: ReturnType<typeof vi.fn>;
    setVipStatus: ReturnType<typeof vi.fn>;
    getLoginHistory: ReturnType<typeof vi.fn>;
    banUser: ReturnType<typeof vi.fn>;
    warnUser: ReturnType<typeof vi.fn>;
  };
  let mockI18n: {
    translate: ReturnType<typeof vi.fn>;
  };

  const sampleUser: AdminUserSummary = {
    id: 'user-42',
    display_name: 'Jordan',
    native_languages: ['en'],
    target_languages: ['fr'],
    is_vip: false,
    vip_tier: 'free',
    is_admin: false,
    coins_balance: 50,
    study_streak_days: 7,
    created_at: '2026-08-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    toastsSignal.set([]);

    mockAdminService = {
      listUsers: vi.fn().mockResolvedValue({
        users: [sampleUser],
        total: 1,
        page: 1,
        pageSize: 20,
      }),
      setVipStatus: vi.fn().mockResolvedValue({ ...sampleUser, is_vip: true }),
      getLoginHistory: vi.fn().mockResolvedValue([
        {
          id: 'log-1',
          created_at: '2026-08-02T00:00:00.000Z',
          ip_address: '127.0.0.1',
          user_agent: 'TestAgent',
        },
      ]),
      banUser: vi.fn().mockResolvedValue({ message: 'User banned' }),
      warnUser: vi.fn().mockResolvedValue({ message: 'Warning issued' }),
    };

    mockI18n = {
      translate: vi.fn().mockImplementation((key: string) => key),
    };

    await TestBed.configureTestingModule({
      imports: [AdminPortalComponent],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPortalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    toastsSignal.set([]);
    vi.restoreAllMocks();
  });

  it('should create and display loaded users', () => {
    expect(component).toBeTruthy();
    expect(component.users().length).toBe(1);
    expect(component.users()[0].id).toBe('user-42');
  });

  it('falls back to common.unknownUser when user display name is missing', () => {
    const userWithoutName: AdminUserSummary = {
      ...sampleUser,
      display_name: undefined,
    };
    expect(component.displayNameFor(userWithoutName)).toBe('common.unknownUser');
    expect(component.displayNameFor(sampleUser)).toBe('Jordan');
  });

  it('updates search and navigates pages', () => {
    component.onSearchInput('Alex');
    expect(component.searchTerm()).toBe('Alex');

    component.runSearch();
    expect(component.page()).toBe(1);

    component.goToPage(1);
    // Only 1 page total so page should stay 1
    expect(component.page()).toBe(1);
  });

  it('toggles VIP status and clears updating flag', async () => {
    await component.toggleVip(sampleUser);
    expect(mockAdminService.setVipStatus).toHaveBeenCalledWith('user-42', true);
    expect(component.vipUpdatingId()).toBeNull();
  });

  it('sets error message when toggleVip fails', async () => {
    mockAdminService.setVipStatus.mockRejectedValueOnce(new Error('VIP error'));
    await component.toggleVip(sampleUser);
    expect(component.errorMessage()).toBe('admin.vipUpdateError');
    expect(component.vipUpdatingId()).toBeNull();
  });

  it('fetches login history when opened and avoids refetching', async () => {
    await component.onLoginHistoryToggle(sampleUser, true);
    expect(mockAdminService.getLoginHistory).toHaveBeenCalledWith('user-42');
    expect(component.loginHistoryByUser()['user-42']).toHaveLength(1);

    mockAdminService.getLoginHistory.mockClear();
    // Subsequent toggle with existing cache does not call service
    await component.onLoginHistoryToggle(sampleUser, true);
    expect(mockAdminService.getLoginHistory).not.toHaveBeenCalled();

    // Closed toggle does not fetch
    await component.onLoginHistoryToggle(sampleUser, false);
    expect(mockAdminService.getLoginHistory).not.toHaveBeenCalled();
  });

  describe('handleWarn', () => {
    it('cancels warn action when confirm dialog is dismissed', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      await component.handleWarn(sampleUser);

      expect(mockAdminService.warnUser).not.toHaveBeenCalled();
      expect(component.moderationActingId()).toBeNull();
    });

    it('issues warning and shows success toast when confirmed', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      await component.handleWarn(sampleUser);

      expect(mockAdminService.warnUser).toHaveBeenCalledWith('user-42');
      expect(component.moderationActingId()).toBeNull();
      const lastToast = toastsSignal().at(-1);
      expect(lastToast).toMatchObject({
        message: 'admin.warningIssued',
        type: 'success',
      });
    });

    it('shows error toast and clears moderationActingId when warn fails', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockAdminService.warnUser.mockRejectedValueOnce(new Error('Network error'));

      await component.handleWarn(sampleUser);

      expect(component.moderationActingId()).toBeNull();
      const lastToast = toastsSignal().at(-1);
      expect(lastToast).toMatchObject({
        message: 'admin.warningFailed',
        type: 'error',
      });
    });
  });

  describe('handleBan', () => {
    it('cancels ban action when confirm dialog is dismissed', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      await component.handleBan(sampleUser);

      expect(mockAdminService.banUser).not.toHaveBeenCalled();
      expect(component.moderationActingId()).toBeNull();
    });

    it('executes ban and shows success toast when confirmed', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      await component.handleBan(sampleUser);

      expect(mockAdminService.banUser).toHaveBeenCalledWith('user-42');
      expect(component.moderationActingId()).toBeNull();
      const lastToast = toastsSignal().at(-1);
      expect(lastToast).toMatchObject({
        message: 'admin.userBanned',
        type: 'success',
      });
    });

    it('shows error toast and clears moderationActingId when ban fails', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockAdminService.banUser.mockRejectedValueOnce(new Error('Database error'));

      await component.handleBan(sampleUser);

      expect(component.moderationActingId()).toBeNull();
      const lastToast = toastsSignal().at(-1);
      expect(lastToast).toMatchObject({
        message: 'admin.banFailed',
        type: 'error',
      });
    });
  });
});
