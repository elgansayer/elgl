/**
 * @vitest-environment jsdom
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { ForgotPasswordComponent } from './forgot-password.component';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { I18nService } from '../../services/i18n.service';
import { signal } from '@angular/core';
import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  const i18nServiceStub = {
    translate: (key: string) => key,
    currentLocale: signal('en'),
    currentDirection: signal<'ltr' | 'rtl'>('ltr'),
  };

  beforeEach(async () => {
    authService = jasmine.createSpyObj('AuthService', ['requestPasswordReset', 'resetPassword']);
    router = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        { provide: AuthService, useValue: authServiceStub },
        { provide: I18nService, useValue: i18nServiceStub },
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

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should display the email form when no token query param is present', () => {
    const emailInput = fixture.debugElement.query(By.css('#email'));
    expect(emailInput).not.toBeNull();
  });

  it('should call authService.requestPasswordReset when email form is submitted with valid email', async () => {
    component.emailForm.controls.email.setValue('test@example.com');
    await component.sendResetRequest();
    expect(requestPasswordResetMock).toHaveBeenCalledWith('test@example.com');
    expect(component.sendSuccess()).toBe(true);
    expect(component.isSending()).toBe(false);
  });

    it('should call authService.resetPassword and navigate on valid submit', async () => {
      authService.resetPassword.and.returnValue(Promise.resolve());

    component.sendResetRequest();

      expect(authService.resetPassword).toHaveBeenCalledWith('reset-token-abc', 'newPass123!');
      expect(component.resetSuccess()).toBeTrue();
      expect(component.isResetting()).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('should set resetError on reset failure', async () => {
      authService.resetPassword.and.returnValue(Promise.reject(new Error('Invalid token')));

  it('should show error on failed reset request', async () => {
    component.emailForm.controls.email.setValue('test@test.com');
    component.sendResetRequest();

      expect(component.resetError()).toBe('forgot_password.reset_error');
      expect(component.isResetting()).toBeFalse();
    });

    await fixture.whenStable();
    expect(component.sendError()).toBe('forgot_password.send_error');
    expect(component.isSending()).toBe(false);
    expect(component.sendSuccess()).toBe(false);
  });

  it('should not call requestPasswordReset when emailForm is invalid', async () => {
    component.emailForm.controls.email.setValue('');
    await component.sendResetRequest();
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it('should not call resetPassword when token is missing and reset form submitted', async () => {
    component.resetForm.controls.newPassword.setValue('newPassword123');
    await component.doPasswordReset();
    expect(resetPasswordMock).not.toHaveBeenCalled();
    expect(component.resetSuccess()).toBe(false);
  });

  it('should disable submit button when email form is invalid', () => {
    const button = fixture.debugElement.query(By.css('button[type="submit"]'));
    expect(button.nativeElement.disabled).toBe(true);
  });

  it('should enable submit button when email form is valid', () => {
    component.emailForm.controls.email.setValue('test@example.com');
    fixture.detectChanges();
    const button = fixture.debugElement.query(By.css('button[type="submit"]'));
    expect(button.nativeElement.disabled).toBe(false);
  });

  it('should show back-to-home link', () => {
    const link = fixture.debugElement.query(By.css('a[routerLink="/home"]'));
    expect(link).not.toBeNull();
  });

  it('should show sendSuccess message after successful request', () => {
    component.sendSuccess.set(true);
    fixture.detectChanges();
    const successMsg = fixture.debugElement.query(By.css('.text-success'));
    expect(successMsg).not.toBeNull();
  });
});