import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangePasswordComponent } from './change-password.component';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../services/auth.service';

describe('ChangePasswordComponent', () => {
  let fixture: ComponentFixture<ChangePasswordComponent>;
  let component: ChangePasswordComponent;
  let authService: jest.Mocked<Pick<AuthService, 'changePassword'>>;

  beforeEach(async () => {
    authService = {
      changePassword: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ChangePasswordComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChangePasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render the change password title', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('auth.changePassword.title');
  });

  it('should show current and new password inputs', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('input#currentPassword')).toBeTruthy();
    expect(el.querySelector('input#newPassword')).toBeTruthy();
  });

  it('should call authService.changePassword on submit', async () => {
    component.currentPassword.set('oldPass');
    component.newPassword.set('newPass123!');
    authService.changePassword.mockResolvedValue(undefined);

    await component.onSubmit();

    expect(authService.changePassword).toHaveBeenCalledWith('oldPass', 'newPass123!');
  });

  it('should not submit when currentPassword is empty', async () => {
    component.currentPassword.set('');
    component.newPassword.set('newPass123!');

    await component.onSubmit();

    expect(authService.changePassword).not.toHaveBeenCalled();
  });

  it('should not submit when newPassword is empty', async () => {
    component.currentPassword.set('oldPass');
    component.newPassword.set('');

    await component.onSubmit();

    expect(authService.changePassword).not.toHaveBeenCalled();
  });

  it('should show error on failure', async () => {
    component.currentPassword.set('oldPass');
    component.newPassword.set('newPass123!');
    authService.changePassword.mockRejectedValue(new Error('fail'));

    await component.onSubmit();

    expect(component.isError()).toBeTrue();
    expect(component.messageKey()).toBe('auth.changePassword.error');
  });

  it('should disable submit button while submitting', () => {
    component.submitting.set(true);
    fixture.detectChanges();
    const btn = (fixture.nativeElement as HTMLElement).querySelector('button[type="submit"]');
    expect(btn?.hasAttribute('disabled')).toBeTrue();
  });
});