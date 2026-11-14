import { TestBed } from '@angular/core/testing';
import { AccountDeletionComponent } from './account-deletion.component';
import { UserService } from '../../services/user.service';
import { I18nService } from '../../services/i18n.service';

describe('AccountDeletionComponent', () => {
  let userService: {
    deleteMyAccount: ReturnType<typeof vi.fn>;
    restoreMyAccount: ReturnType<typeof vi.fn>;
    downloadMyData: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    userService = {
      deleteMyAccount: vi.fn().mockResolvedValue({
        message: 'Deletion scheduled',
        scheduled_for_deletion_at: '2026-12-14T00:00:00.000Z',
      }),
      restoreMyAccount: vi.fn().mockResolvedValue({ message: 'Restored' }),
      downloadMyData: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [AccountDeletionComponent],
      providers: [
        { provide: UserService, useValue: userService },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing when the confirmation dialog is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const component = TestBed.createComponent(
      AccountDeletionComponent,
    ).componentInstance;

    await component.requestDeletion();

    expect(userService.deleteMyAccount).not.toHaveBeenCalled();
    expect(component.isLoading()).toBe(false);
  });

  it('schedules deletion and exposes the scheduled date', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const component = TestBed.createComponent(
      AccountDeletionComponent,
    ).componentInstance;

    await component.requestDeletion();

    expect(userService.deleteMyAccount).toHaveBeenCalledTimes(1);
    expect(component.deletionScheduled()).toBe('2026-12-14T00:00:00.000Z');
    expect(component.message()).toBe('Deletion scheduled');
    expect(component.isError()).toBe(false);
  });

  it('reports a failed deletion request', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    userService.deleteMyAccount.mockRejectedValue(new Error('offline'));
    const component = TestBed.createComponent(
      AccountDeletionComponent,
    ).componentInstance;

    await component.requestDeletion();

    expect(component.message()).toBe('Failed to request deletion.');
    expect(component.isError()).toBe(true);
    expect(component.isLoading()).toBe(false);
  });

  it('restores the account and clears the scheduled date', async () => {
    const component = TestBed.createComponent(
      AccountDeletionComponent,
    ).componentInstance;
    component.deletionScheduled.set('2026-12-14T00:00:00.000Z');

    await component.restoreAccount();

    expect(userService.restoreMyAccount).toHaveBeenCalledTimes(1);
    expect(component.deletionScheduled()).toBeNull();
    expect(component.message()).toBe('Restored');
  });

  it('reports a failed restore', async () => {
    userService.restoreMyAccount.mockRejectedValue(new Error('offline'));
    const component = TestBed.createComponent(
      AccountDeletionComponent,
    ).componentInstance;

    await component.restoreAccount();

    expect(component.message()).toBe('Failed to restore account.');
    expect(component.isError()).toBe(true);
  });

  it('exports data and reports the outcome', async () => {
    const component = TestBed.createComponent(
      AccountDeletionComponent,
    ).componentInstance;

    await component.exportData();

    expect(userService.downloadMyData).toHaveBeenCalledTimes(1);
    expect(component.message()).toBe('Data export downloaded successfully.');
    expect(component.isError()).toBe(false);
  });

  it('reports a failed data export', async () => {
    userService.downloadMyData.mockRejectedValue(new Error('offline'));
    const component = TestBed.createComponent(
      AccountDeletionComponent,
    ).componentInstance;

    await component.exportData();

    expect(component.message()).toBe('Failed to export data.');
    expect(component.isError()).toBe(true);
  });
});
