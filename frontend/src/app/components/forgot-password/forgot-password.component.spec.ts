import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { By } from '@angular/platform-browser';
import { describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';
import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let requestPasswordResetMock: ReturnType<typeof vi.fn>;
  let resetPasswordMock: ReturnType<typeof vi.fn>;

  const i18nServiceStub = {
    translate: (key: string) => key,
    currentLocale: signal('en'),
    currentDirection: signal<'ltr' | 'rtl'>('ltr'),
  };

  beforeEach(async () => {
    requestPasswordResetMock = vi.fn().mockResolvedValue(undefined);
    resetPasswordMock = vi.fn().mockResolvedValue(undefined);

    const authServiceStub = {
      requestPasswordReset: requestPasswordResetMock,
      resetPassword: resetPasswordMock,
    };

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

  it('should create', () => {
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

  it('should set sendError when requestPasswordReset fails', async () => {
    requestPasswordResetMock.mockRejectedValueOnce(new Error('Network error'));
    component.emailForm.controls.email.setValue('test@example.com');

    await component.sendResetRequest();
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