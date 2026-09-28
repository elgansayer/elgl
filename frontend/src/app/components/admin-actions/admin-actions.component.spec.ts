import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminService } from '../../services/admin.service';
import { I18nService } from '../../services/i18n.service';
import { AdminActionsComponent } from './admin-actions.component';
import { showErrorToast, showToast } from '../../services/toast.service';

vi.mock('../../services/toast.service', () => ({
  showToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('AdminActionsComponent', () => {
  const adminService = {
    listUsers: vi.fn().mockResolvedValue({ users: [], total: 0, page: 1, pageSize: 10 }),
    banUser: vi.fn(),
    warnUser: vi.fn(),
  };
  const i18n = {
    translate: vi.fn((key: string) => key),
  };

  let component: AdminActionsComponent;

  beforeEach(() => {
    vi.clearAllMocks();
    adminService.listUsers.mockResolvedValue({ users: [], total: 0, page: 1, pageSize: 10 });

    TestBed.configureTestingModule({
      providers: [
        { provide: AdminService, useValue: adminService },
        { provide: I18nService, useValue: i18n },
      ],
    });

    component = TestBed.runInInjectionContext(() => new AdminActionsComponent());
  });

  it('deduplicates rapid ban clicks and exposes a successful accessible outcome', async () => {
    const request = deferred<{ message: string }>();
    adminService.banUser.mockReturnValue(request.promise);

    const first = component.ban('user-1');
    const duplicate = component.ban('user-1');

    expect(adminService.banUser).toHaveBeenCalledTimes(1);
    expect(component.isPending('user-1', 'ban')).toBe(true);
    expect(component.isActionDisabled('user-1', 'ban')).toBe(true);
    expect(component.isActionDisabled('user-1', 'warn')).toBe(true);

    request.resolve({ message: 'User banned' });
    await Promise.all([first, duplicate]);

    expect(component.isPending('user-1')).toBe(false);
    expect(component.statusKey('user-1')).toBe('admin.userBanned');
    expect(component.isFailure('user-1')).toBe(false);
    expect(component.isActionDisabled('user-1', 'ban')).toBe(true);
    expect(component.isActionDisabled('user-1', 'warn')).toBe(false);
    expect(showToast).toHaveBeenCalledWith('admin.userBanned', 'success');
  });

  it('keeps a failed ban retryable and reports the failure without provider details', async () => {
    adminService.banUser.mockRejectedValue(new Error('sensitive provider error'));

    await component.ban('user-2');

    expect(component.isPending('user-2')).toBe(false);
    expect(component.statusKey('user-2')).toBe('admin.banFailed');
    expect(component.isFailure('user-2')).toBe(true);
    expect(component.isActionDisabled('user-2', 'ban')).toBe(false);
    expect(showErrorToast).toHaveBeenCalledWith('admin.banFailed');
  });

  it('serializes ban and warning mutations for the same user', async () => {
    const request = deferred<{ message: string }>();
    adminService.banUser.mockReturnValue(request.promise);

    const ban = component.ban('user-3');
    await component.warn('user-3');

    expect(adminService.banUser).toHaveBeenCalledTimes(1);
    expect(adminService.warnUser).not.toHaveBeenCalled();

    request.resolve({ message: 'User banned' });
    await ban;
  });

  it('marks a successful warning complete and prevents an accidental duplicate warning', async () => {
    adminService.warnUser.mockResolvedValue({ message: 'User warned' });

    await component.warn('user-4');
    await component.warn('user-4');

    expect(adminService.warnUser).toHaveBeenCalledTimes(1);
    expect(component.statusKey('user-4')).toBe('admin.warningIssued');
    expect(component.isActionDisabled('user-4', 'warn')).toBe(true);
    expect(component.isActionDisabled('user-4', 'ban')).toBe(false);
    expect(showToast).toHaveBeenCalledWith('admin.warningIssued', 'success');
  });

  it('does not send a moderation request for an empty user id', async () => {
    await component.ban('');
    await component.warn('');

    expect(adminService.banUser).not.toHaveBeenCalled();
    expect(adminService.warnUser).not.toHaveBeenCalled();
  });
});
