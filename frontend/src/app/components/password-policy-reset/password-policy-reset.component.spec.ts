import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PasswordPolicyResetComponent } from './password-policy-reset.component';
import { AuthService } from '../../services/auth.service';

describe.skip('PasswordPolicyResetComponent', () => {
  let component: PasswordPolicyResetComponent;
  let fixture: ComponentFixture<PasswordPolicyResetComponent>;
  let authServiceMock: { changePassword: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authServiceMock = {
      changePassword: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PasswordPolicyResetComponent],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordPolicyResetComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show min length requirement as invalid initially', () => {
    expect(component.hasMinLength()).toBe(false);
  });

  it('should show min length as valid when password is 8+ chars', () => {
    component.newPassword.set('abcdefgh');
    fixture.detectChanges();
    expect(component.hasMinLength()).toBe(true);
  });

  it('should detect digit presence', () => {
    expect(component.hasNumber()).toBe(false);
    component.newPassword.set('abc1defg');
    fixture.detectChanges();
    expect(component.hasNumber()).toBe(true);
  });

  it('should detect symbol presence', () => {
    expect(component.hasSymbol()).toBe(false);
    component.newPassword.set('abc!defg');
    fixture.detectChanges();
    expect(component.hasSymbol()).toBe(true);
  });

  it('should check password match', () => {
    component.newPassword.set('Test@1234');
    component.confirmPassword.set('Test@1234');
    fixture.detectChanges();
    expect(component.passwordsMatch()).toBe(true);

    component.confirmPassword.set('Different');
    fixture.detectChanges();
    expect(component.passwordsMatch()).toBe(false);
  });

  it('should compute allValid correctly', () => {
    // invalid - no symbol
    component.newPassword.set('Test1234');
    component.confirmPassword.set('Test1234');
    fixture.detectChanges();
    expect(component.allValid()).toBe(false);

    // valid
    component.newPassword.set('Test@1234');
    component.confirmPassword.set('Test@1234');
    fixture.detectChanges();
    expect(component.allValid()).toBe(true);
  });

  it('should call changePassword on reset and show success message', async () => {
    authServiceMock.changePassword.mockResolvedValue(undefined);
    component.currentPassword.set('Old@1234');
    component.newPassword.set('Test@1234');
    component.confirmPassword.set('Test@1234');

    await component.resetPassword();

    expect(authServiceMock.changePassword).toHaveBeenCalledWith('Old@1234', 'Test@1234');
    expect(component.successMessage()).toBe('password.resetSuccess');
    expect(component.errorMessage()).toBeNull();
  });

  it('should show error message on reset failure', async () => {
    authServiceMock.changePassword.mockRejectedValue(new Error('bad request'));
    component.currentPassword.set('Old@1234');
    component.newPassword.set('Test@1234');
    component.confirmPassword.set('Test@1234');

    await component.resetPassword();

    expect(component.errorMessage()).toBe('password.resetError');
    expect(component.successMessage()).toBeNull();
  });

  it('should not call changePassword when form is invalid', async () => {
    component.newPassword.set('');
    await component.resetPassword();
    expect(authServiceMock.changePassword).not.toHaveBeenCalled();
  });
});