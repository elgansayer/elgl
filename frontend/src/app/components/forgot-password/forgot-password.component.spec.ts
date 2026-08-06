import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../services/translate.pipe';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  const createActivatedRoute = (token: string | null) => ({
    queryParamMap: of({
      get: (_key: string) => token,
      has: (_key: string) => token !== null,
      getAll: (_key: string) => token ? [token] : [],
      keys: token ? ['token'] : [],
    }),
  });

  beforeEach(async () => {
    authService = jasmine.createSpyObj('AuthService', ['requestPasswordReset', 'resetPassword']);
    router = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: createActivatedRoute(null) },
        TranslatePipe,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('email form (no token)', () => {
    it('should show the email form when there is no token query param', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('#email')).not.toBeNull();
      expect(compiled.querySelector('#newPassword')).toBeNull();
    });

    it('should call authService.requestPasswordReset on valid submit', async () => {
      authService.requestPasswordReset.and.returnValue(Promise.resolve());

      component.emailForm.setValue({ email: 'test@example.com' });
      await component.sendResetRequest();

      expect(authService.requestPasswordReset).toHaveBeenCalledWith('test@example.com');
      expect(component.sendSuccess()).toBeTrue();
      expect(component.isSending()).toBeFalse();
    });

    it('should set sendError on request failure', async () => {
      authService.requestPasswordReset.and.returnValue(Promise.reject(new Error('Network error')));

      component.emailForm.setValue({ email: 'test@example.com' });
      await component.sendResetRequest();

      expect(component.sendError()).toBe('forgot_password.send_error');
      expect(component.isSending()).toBeFalse();
    });

    it('should not submit if emailForm is invalid', async () => {
      component.emailForm.setValue({ email: '' });
      await component.sendResetRequest();

      expect(authService.requestPasswordReset).not.toHaveBeenCalled();
    });
  });

  describe('password reset form (with token)', () => {
    beforeEach(async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [ForgotPasswordComponent],
        providers: [
          { provide: AuthService, useValue: authService },
          { provide: Router, useValue: router },
          { provide: ActivatedRoute, useValue: createActivatedRoute('reset-token-abc') },
          TranslatePipe,
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(ForgotPasswordComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should show the reset form when a token query param is present', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('#newPassword')).not.toBeNull();
      expect(compiled.querySelector('#email')).toBeNull();
    });

    it('should call authService.resetPassword and navigate on valid submit', async () => {
      authService.resetPassword.and.returnValue(Promise.resolve());

      component.resetForm.setValue({ newPassword: 'newPass123!' });
      await component.doPasswordReset();

      expect(authService.resetPassword).toHaveBeenCalledWith('reset-token-abc', 'newPass123!');
      expect(component.resetSuccess()).toBeTrue();
      expect(component.isResetting()).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('should set resetError on reset failure', async () => {
      authService.resetPassword.and.returnValue(Promise.reject(new Error('Invalid token')));

      component.resetForm.setValue({ newPassword: 'newPass123!' });
      await component.doPasswordReset();

      expect(component.resetError()).toBe('forgot_password.reset_error');
      expect(component.isResetting()).toBeFalse();
    });

    it('should not submit if resetForm is invalid', async () => {
      component.resetForm.setValue({ newPassword: 'sh0rt' });
      await component.doPasswordReset();

      expect(authService.resetPassword).not.toHaveBeenCalled();
    });
  });
});