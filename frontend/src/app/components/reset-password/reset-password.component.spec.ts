import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../services/translate.pipe';

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj('AuthService', ['resetPassword']);
    router = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (_key: string) => 'reset-token-abc',
              },
            },
          },
        },
        TranslatePipe,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should autofill the token from query params', () => {
    expect(component.resetForm.controls.token.value).toBe('reset-token-abc');
  });

  it('should call authService.resetPassword and navigate on valid submit', async () => {
    authService.resetPassword.and.returnValue(Promise.resolve());

    component.resetForm.setValue({ token: 'reset-token-abc', newPassword: 'newPass123!' });
    await component.onSubmit();

    expect(authService.resetPassword).toHaveBeenCalledWith('reset-token-abc', 'newPass123!');
    expect(component.messageKey()).toBe('auth.resetPassword.success');
    expect(component.isError()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('should set error message on reset failure', async () => {
    authService.resetPassword.and.returnValue(Promise.reject(new Error('Invalid token')));

    component.resetForm.setValue({ token: 'bad-token', newPassword: 'newPass123!' });
    await component.onSubmit();

    expect(component.messageKey()).toBe('auth.resetPassword.error');
    expect(component.isError()).toBeTrue();
  });

  it('should not submit if form is invalid', async () => {
    component.resetForm.setValue({ token: '', newPassword: 'short' });
    await component.onSubmit();

    expect(authService.resetPassword).not.toHaveBeenCalled();
  });
});