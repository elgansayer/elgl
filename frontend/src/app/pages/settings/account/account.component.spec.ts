import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccountSettingsComponent } from './account.component';
import { SettingsService } from '../../../core/services/settings.service';
import { AccountSettings } from '../../../core/models/settings.model';

const mockAccount: AccountSettings = {
  email: 'user@example.com',
  isEmailVerified: true,
  twoFactorEnabled: false,
  hardwareKeysCount: 2,
  activeSessions: 3,
};

describe('AccountSettingsComponent', () => {
  let component: AccountSettingsComponent;
  let fixture: ComponentFixture<AccountSettingsComponent>;
  let settingsServiceMock: {
    accountSettings: ReturnType<typeof vi.fn>;
    updateAccountSettings: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    settingsServiceMock = {
      accountSettings: vi.fn().mockReturnValue(mockAccount),
      updateAccountSettings: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [AccountSettingsComponent],
      providers: [
        { provide: SettingsService, useValue: settingsServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the account title', () => {
    const title = fixture.nativeElement.querySelector('h2');
    expect(title.textContent).toContain('settings.account.title');
  });

  it('should display verified email address', () => {
    const emailElement = fixture.nativeElement.querySelector('.setting-item p');
    expect(emailElement.textContent).toContain('user@example.com');
  });

  it('should show verified badge when email is verified', () => {
    const badge = fixture.nativeElement.querySelector('.verified-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('settings.account.email.verified');
  });

  it('should not show verified badge when email is not verified', async () => {
    const accountNotVerified = { ...mockAccount, isEmailVerified: false };
    settingsServiceMock.accountSettings.mockReturnValue(accountNotVerified);
    fixture = TestBed.createComponent(AccountSettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const badge = fixture.nativeElement.querySelector('.verified-badge');
    expect(badge).toBeFalsy();
  });

  it('should display active sessions count', () => {
    const sessionsInfo = fixture.nativeElement.querySelector('.setting-item:last-child .setting-info p');
    expect(sessionsInfo.textContent).toContain('3');
  });

  it('should call updateAccountSettings when terminating a session', () => {
    component.terminateSession();
    expect(settingsServiceMock.updateAccountSettings).toHaveBeenCalledWith({ activeSessions: 2 });
  });

  it('should not terminate sessions when count is zero', () => {
    settingsServiceMock.accountSettings.mockReturnValue({ ...mockAccount, activeSessions: 0 });

    const newFixture = TestBed.createComponent(AccountSettingsComponent);
    const newComponent = newFixture.componentInstance;
    newComponent.terminateSession();

    expect(settingsServiceMock.updateAccountSettings).not.toHaveBeenCalled();
  });

  it('should call updateTwoFactorSetting on toggle change', () => {
    component.twoFactorForm.patchValue({ twoFactorEnabled: true });
    component.updateTwoFactorSetting();
    expect(settingsServiceMock.updateAccountSettings).toHaveBeenCalledWith({ twoFactorEnabled: true });
  });

  it('should have an invalid password form by default', () => {
    expect(component.passwordForm.valid).toBe(false);
  });

  it('should mark passwordForm valid when all fields are filled correctly', () => {
    component.passwordForm.patchValue({
      currentPassword: 'oldpass123',
      newPassword: 'newpass123',
      confirmPassword: 'newpass123',
    });
    expect(component.passwordForm.valid).toBe(true);
  });

  it('should show mismatch error when passwords do not match', () => {
    component.passwordForm.patchValue({
      currentPassword: 'oldpass123',
      newPassword: 'newpass123',
      confirmPassword: 'different456',
    });
    expect(component.passwordForm.hasError('mismatch')).toBe(true);
  });

  it('should show minLength error on short password', () => {
    component.passwordForm.patchValue({
      currentPassword: 'oldpass123',
      newPassword: 'short',
      confirmPassword: 'short',
    });
    expect(component.passwordForm.get('newPassword')?.hasError('minlength')).toBe(true);
  });

  it('should call updateAccountSettings and reset form on password change', async () => {
    component.passwordForm.patchValue({
      currentPassword: 'oldpass123',
      newPassword: 'newpass123',
      confirmPassword: 'newpass123',
    });
    component.changePassword();

    expect(settingsServiceMock.updateAccountSettings).toHaveBeenCalledWith({});
    expect(component.passwordForm.get('currentPassword')?.value).toBe(null);
  });

  it('should set success message after password change', async () => {
    component.passwordForm.patchValue({
      currentPassword: 'oldpass123',
      newPassword: 'newpass123',
      confirmPassword: 'newpass123',
    });
    component.changePassword();

    expect(component.successMessage()).toBe('settings.account.password.success');
  });
});
