import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResetPasswordComponent } from './reset-password.component';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

describe('ResetPasswordComponent', () => {
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let component: ResetPasswordComponent;
  let authService: jest.Mocked<Pick<AuthService, 'resetPassword'>>;
  let router: Router;

  beforeEach(async () => {
    authService = {
      resetPassword: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideRouter([
          { path: 'reset-password', component: ResetPasswordComponent },
          { path: 'home', component: ResetPasswordComponent },
        ]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => null } } },
        },
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should render the reset password title', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('auth.resetPassword.title');
  });

  it('should show the new password input', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('input#newPassword')).toBeTruthy();
  });

  it('should call authService.resetPassword on submit', async () => {
    component.token.set('test-token-123');
    component.resetForm.controls.newPassword.setValue('newPass123!');
    authService.resetPassword.mockResolvedValue(undefined);

    await component.onSubmit();

    expect(authService.resetPassword).toHaveBeenCalledWith('test-token-123', 'newPass123!');
  });

  it('should not submit when token is empty', async () => {
    component.token.set('');
    component.resetForm.controls.newPassword.setValue('newPass123!');

    await component.onSubmit();

    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it('should not submit when form is invalid', async () => {
    component.token.set('test-token');
    component.resetForm.controls.newPassword.setValue('');

    await component.onSubmit();

    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it('should show error message on failure', async () => {
    component.token.set('test-token');
    component.resetForm.controls.newPassword.setValue('newPass123!');
    authService.resetPassword.mockRejectedValue(new Error('fail'));

    await component.onSubmit();

    expect(component.isError()).toBeTrue();
    expect(component.messageKey()).toBe('auth.resetPassword.error');
  });

  it('should disable submit button while submitting', () => {
    component.submitting.set(true);
    fixture.detectChanges();
    const btn = (fixture.nativeElement as HTMLElement).querySelector('button[type="submit"]');
    expect(btn?.hasAttribute('disabled')).toBeTrue();
  });
});