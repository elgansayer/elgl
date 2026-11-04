import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminService } from '../../services/admin.service';
import { I18nService } from '../../services/i18n.service';
import { AdminActionsComponent } from './admin-actions.component';
import { toastsSignal } from '../../services/toast.service';

// Angular's unit-test builder cannot vi.mock relative modules; assert the shared toast state instead.
function lastToast(): { message: string; type: string } | undefined {
  return toastsSignal().at(-1);
}

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
    toastsSignal.set([]);
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
    expect(lastToast()).toMatchObject({ message: 'admin.userBanned', type: 'success' });
  });

  it('keeps a failed ban retryable and reports the failure without provider details', async () => {
    adminService.banUser.mockRejectedValue(new Error('sensitive provider error'));

    await component.ban('user-2');

    expect(component.isPending('user-2')).toBe(false);
    expect(component.statusKey('user-2')).toBe('admin.banFailed');
    expect(component.isFailure('user-2')).toBe(true);
    expect(component.isActionDisabled('user-2', 'ban')).toBe(false);
    expect(lastToast()).toMatchObject({ message: 'admin.banFailed', type: 'error' });
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
    expect(lastToast()).toMatchObject({ message: 'admin.warningIssued', type: 'success' });
  });

  it('does not send a moderation request for an empty user id', async () => {
    await component.ban('');
    await component.warn('');

    expect(adminService.banUser).not.toHaveBeenCalled();
    expect(adminService.warnUser).not.toHaveBeenCalled();
  });

  it('opens confirmation dialog on requestBan and closes on cancelBan without banning', () => {
    expect(component.banDialogState()).toBe('closed');
    component.requestBan('user-5', 'Jordan');
    expect(component.banDialogState()).toBe('open');
    expect(component.pendingBanTarget()).toEqual({ id: 'user-5', name: 'Jordan' });

    component.cancelBan();
    expect(component.banDialogState()).toBe('closed');
    expect(component.pendingBanTarget()).toBeNull();
    expect(adminService.banUser).not.toHaveBeenCalled();
  });

  it('bans user and closes dialog on confirmBan', async () => {
    adminService.banUser.mockResolvedValue({ message: 'User banned' });
    component.requestBan('user-6', 'Jordan');

    await component.confirmBan();
    expect(component.banDialogState()).toBe('closed');
    expect(component.pendingBanTarget()).toBeNull();
    expect(adminService.banUser).toHaveBeenCalledWith('user-6');
  });

  it('cancels ban when dialog state changed to closed', () => {
    component.requestBan('user-7', 'Jordan');
    expect(component.banDialogState()).toBe('open');

    component.onBanDialogStateChanged('closed');
    expect(component.banDialogState()).toBe('closed');
    expect(component.pendingBanTarget()).toBeNull();
    expect(adminService.banUser).not.toHaveBeenCalled();
  });
});
