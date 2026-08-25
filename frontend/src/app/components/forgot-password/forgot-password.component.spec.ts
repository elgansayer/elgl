/**
 * @vitest-environment jsdom
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';

const VALID_TOKEN = 'a'.repeat(64);

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let authServiceMock: {
    requestPasswordReset: ReturnType<typeof vi.fn>;
    resetPassword: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  async function createComponent(token: string | null = null): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap(token ? { token } : {})),
          },
        },
        {
          provide: I18nService,
          useValue: { translate: vi.fn((key: string) => key) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    authServiceMock = {
      requestPasswordReset: vi.fn(),
      resetPassword: vi.fn(),
    };
    await createComponent();
  });

  it('shows the email form when no reset token is present', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#email')).not.toBeNull();
    expect(compiled.querySelector('#newPassword')).toBeNull();
  });

  it('normalizes email and reports the generic success state', async () => {
    authServiceMock.requestPasswordReset.mockResolvedValue(undefined);
    component.emailForm.setValue({ email: '  User@Example.COM  ' });

    await component.sendResetRequest();
    fixture.detectChanges();

    expect(authServiceMock.requestPasswordReset).toHaveBeenCalledWith('user@example.com');
    expect(component.sendSuccess()).toBe(true);
    expect(component.sendError()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="status"]')).not.toBeNull();
  });

  it('retains a retryable error state without exposing provider details', async () => {
    authServiceMock.requestPasswordReset.mockRejectedValue(new Error('smtp secret detail'));
    component.emailForm.setValue({ email: 'user@example.com' });

    await component.sendResetRequest();

    expect(component.sendError()).toBe('forgot_password.send_error');
    expect(component.isSending()).toBe(false);
  });

  it('does not submit invalid email input', async () => {
    component.emailForm.setValue({ email: 'not-an-email' });

    await component.sendResetRequest();

    expect(authServiceMock.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('supports legacy forgot-password links with a valid one-time token', async () => {
    await createComponent(VALID_TOKEN);
    authServiceMock.resetPassword.mockResolvedValue(undefined);
    component.resetForm.setValue({ newPassword: 'newPass123!' });

    await component.doPasswordReset();

    expect(authServiceMock.resetPassword).toHaveBeenCalledWith(VALID_TOKEN, 'newPass123!');
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('rejects malformed reset tokens before calling the backend', async () => {
    await createComponent('not-a-reset-token');
    component.resetForm.setValue({ newPassword: 'newPass123!' });

    await component.doPasswordReset();

    expect(authServiceMock.resetPassword).not.toHaveBeenCalled();
    expect(component.resetError()).toBe('forgot_password.reset_error');
  });

  it('prevents duplicate reset submissions while a request is in flight', async () => {
    await createComponent(VALID_TOKEN);
    let resolveReset: (() => void) | undefined;
    authServiceMock.resetPassword.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveReset = resolve;
      }),
    );
    component.resetForm.setValue({ newPassword: 'newPass123!' });

    const first = component.doPasswordReset();
    await component.doPasswordReset();

    expect(authServiceMock.resetPassword).toHaveBeenCalledTimes(1);
    resolveReset?.();
    await first;
  });
});
