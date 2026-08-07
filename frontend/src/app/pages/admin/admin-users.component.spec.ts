import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminUsersComponent } from './admin-users.component';
import { AdminService, AdminUserSummary } from '../../services/admin.service';

const MOCK_USER: AdminUserSummary = {
  id: 'test-user-1',
  display_name: 'Test User',
  avatar_url: null,
  native_languages: ['en'],
  target_languages: ['es'],
  is_vip: false,
  vip_tier: 'free',
  is_admin: false,
  coins_balance: 100,
  study_streak_days: 5,
  last_active_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

describe('AdminUsersComponent', () => {
  let component: AdminUsersComponent;
  let fixture: ComponentFixture<AdminUsersComponent>;
  let adminService: AdminService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminUsersComponent],
      providers: [
        {
          provide: AdminService,
          useValue: {
            listUsers: vi
              .fn()
              .mockResolvedValue({ users: [MOCK_USER], total: 1, page: 1, pageSize: 10 }),
            getLoginHistory: vi.fn().mockResolvedValue([]),
            setVipStatus: vi.fn().mockResolvedValue(MOCK_USER),
            banUser: vi.fn().mockResolvedValue({ message: 'User banned' }),
            warnUser: vi.fn().mockResolvedValue({ message: 'User warned' }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUsersComponent);
    component = fixture.componentInstance;
    adminService = TestBed.inject(AdminService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call banUser on adminService when banUser is invoked', async () => {
    await component.banUser(MOCK_USER);
    expect(adminService.banUser).toHaveBeenCalledWith('test-user-1');
  });

  it('should call warnUser on adminService when warnUser is invoked', async () => {
    await component.warnUser(MOCK_USER);
    expect(adminService.warnUser).toHaveBeenCalledWith('test-user-1');
  });

  it('should set isBanning signal while ban is in progress', async () => {
    let resolveBan: (value: { message: string }) => void;
    const banPromise = new Promise<{ message: string }>((resolve) => {
      resolveBan = resolve;
    });
    (adminService.banUser as ReturnType<typeof vi.fn>).mockReturnValue(banPromise);

    const banCall = component.banUser(MOCK_USER);
    expect(component.isBanning()).toBe('test-user-1');

    resolveBan!({ message: 'User banned' });
    await banCall;
    expect(component.isBanning()).toBeNull();
  });

  it('should set isWarning signal while warn is in progress', async () => {
    let resolveWarn: (value: { message: string }) => void;
    const warnPromise = new Promise<{ message: string }>((resolve) => {
      resolveWarn = resolve;
    });
    (adminService.warnUser as ReturnType<typeof vi.fn>).mockReturnValue(warnPromise);

    const warnCall = component.warnUser(MOCK_USER);
    expect(component.isWarning()).toBe('test-user-1');

    resolveWarn!({ message: 'User warned' });
    await warnCall;
    expect(component.isWarning()).toBeNull();
  });

  it('should not call banUser if already banning a user', async () => {
    (adminService.banUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      message: 'User banned',
    });
    await Promise.all([
      component.banUser(MOCK_USER),
      component.banUser(MOCK_USER),
      component.banUser(MOCK_USER),
    ]);
    expect(adminService.banUser).toHaveBeenCalledTimes(1);
  });

  it('should not call warnUser if already warning a user', async () => {
    (adminService.warnUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      message: 'User warned',
    });
    await Promise.all([
      component.warnUser(MOCK_USER),
      component.warnUser(MOCK_USER),
      component.warnUser(MOCK_USER),
    ]);
    expect(adminService.warnUser).toHaveBeenCalledTimes(1);
  });
});
