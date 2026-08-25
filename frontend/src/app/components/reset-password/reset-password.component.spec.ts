/**
 * @vitest-environment jsdom
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';

const VALID_TOKEN = 'b'.repeat(64);

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let authServiceMock: { resetPassword: ReturnType<typeof vi.fn> };
  let router: Router;

  async function createComponent(token: string = VALID_TOKEN): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
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

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    authServiceMock = { resetPassword: vi.fn() };
    await createComponent();
  });

  it('reads and validates the one-time token from the URL', () => {
    expect(component.token()).toBe(VALID_TOKEN);
    expect(component.hasValidToken()).toBe(true);
  });

  it('submits a bounded password and navigates after success', async () => {
    authServiceMock.resetPassword.mockResolvedValue(undefined);
    component.resetForm.setValue({ newPassword: 'newPass123!' });

    await component.onSubmit();

    expect(authServiceMock.resetPassword).toHaveBeenCalledWith(VALID_TOKEN, 'newPass123!');
    expect(component.messageKey()).toBe('auth.resetPassword.success');
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('shows a retryable generic error when reset fails', async () => {
    authServiceMock.resetPassword.mockRejectedValue(new Error('database detail'));
    component.resetForm.setValue({ newPassword: 'newPass123!' });

    await component.onSubmit();

    expect(component.messageKey()).toBe('auth.resetPassword.error');
    expect(component.isError()).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('rejects malformed or missing tokens before making a request', async () => {
    await createComponent('invalid-token');
    component.resetForm.setValue({ newPassword: 'newPass123!' });

    await component.onSubmit();

    expect(authServiceMock.resetPassword).not.toHaveBeenCalled();
    expect(component.messageKey()).toBe('auth.resetPassword.error');
  });

  it('does not submit invalid or overlong passwords', async () => {
    component.resetForm.setValue({ newPassword: 'x'.repeat(129) });

    await component.onSubmit();

    expect(authServiceMock.resetPassword).not.toHaveBeenCalled();
  });

  it('prevents concurrent duplicate submissions', async () => {
    let resolveReset: (() => void) | undefined;
    authServiceMock.resetPassword.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveReset = resolve;
      }),
    );
    component.resetForm.setValue({ newPassword: 'newPass123!' });

    const first = component.onSubmit();
    await component.onSubmit();

    expect(authServiceMock.resetPassword).toHaveBeenCalledTimes(1);
    resolveReset?.();
    await first;
  });
});
