import { TestBed } from '@angular/core/testing';
import { UserService } from '../../services/user.service';
import { AccountDeletionComponent } from './account-deletion.component';

describe('AccountDeletionComponent', () => {
  const userService = {
    deleteMyAccount: vi.fn(),
    restoreMyAccount: vi.fn(),
    downloadMyData: vi.fn(),
  };

  function create() {
    TestBed.configureTestingModule({
      imports: [AccountDeletionComponent],
      providers: [{ provide: UserService, useValue: userService }],
    });
    return TestBed.createComponent(AccountDeletionComponent);
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it('asks for confirmation with translated copy and does nothing when declined', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const component = create().componentInstance;

    await component.requestDeletion();

    expect(confirm).toHaveBeenCalledWith(
      'Are you sure you want to delete your account? This action can be undone within 30 days.',
    );
    expect(userService.deleteMyAccount).not.toHaveBeenCalled();
  });

  it('reports a translated failure when the deletion request is rejected', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    userService.deleteMyAccount.mockRejectedValue(new Error('network'));
    const component = create().componentInstance;

    await component.requestDeletion();

    expect(component.message()).toBe('Failed to request deletion.');
    expect(component.isError()).toBe(true);
    expect(component.isLoading()).toBe(false);
  });

  it('reports translated restore and export outcomes', async () => {
    userService.restoreMyAccount.mockRejectedValue(new Error('network'));
    userService.downloadMyData
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('x'));
    const component = create().componentInstance;

    await component.restoreAccount();
    expect(component.message()).toBe('Failed to restore account.');

    await component.exportData();
    expect(component.message()).toBe('Data export downloaded successfully.');
    expect(component.isError()).toBe(false);

    await component.exportData();
    expect(component.message()).toBe('Failed to export data.');
    expect(component.isError()).toBe(true);
  });

  it('renders the translated heading and actions instead of raw keys', () => {
    const fixture = create();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Delete your account');
    expect(text).toContain('Delete my account');
    expect(text).toContain('Download my data');
    expect(text).not.toContain('account_deletion.');
  });
});
