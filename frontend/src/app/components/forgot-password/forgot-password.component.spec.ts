import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ForgotPasswordComponent } from './forgot-password.component';
import { ActivatedRoute, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth.service';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let authServiceMock: { requestPasswordReset: ReturnType<typeof vi.fn>; resetPassword: ReturnType<typeof vi.fn> };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };
  let queryParamMap: ReturnType<typeof signal>;

  function createActivatedRouteMock() {
    return {
      queryParamMap: of({
        get: (key: string) => {
          const map = queryParamMap();
          return map.get(key) ?? null;
        },
        has: (key: string) => queryParamMap().has(key),
        keys: () => queryParamMap().keys(),
        getAll: () => [],
      }),
    };
  }

  async function createComponent(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: ActivatedRoute, useValue: createActivatedRouteMock() },
        { provide: Router, useValue: routerMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(async () => {
    queryParamMap = signal(new Map<string, string>());

    authServiceMock = {
      requestPasswordReset: vi.fn(),
      resetPassword: vi.fn(),
    };

    routerMock = {
      navigate: vi.fn(),
    };

    await createComponent();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show email form when no token is present', () => {
    expect(component.tokenQuery()).toBeNull();
    expect(component.emailForm).toBeDefined();
  });

  it('should show reset form when token is present', async () => {
    queryParamMap.set(new Map([['token', 'abc123']]));
    fixture.destroy();
    await createComponent();
    expect(component.tokenQuery()).toBe('abc123');
  });

  it('should set sendSuccess when reset request succeeds', async () => {
    authServiceMock.requestPasswordReset.mockResolvedValue(undefined);
    component.emailForm.controls.email.setValue('user@example.com');

    await component.sendResetRequest();

    expect(authServiceMock.requestPasswordReset).toHaveBeenCalledWith('user@example.com');
    expect(component.sendSuccess()).toBe(true);
    expect(component.isSending()).toBe(false);
  });

  it('should set sendError when reset request fails', async () => {
    authServiceMock.requestPasswordReset.mockRejectedValue(new Error('network error'));
    component.emailForm.controls.email.setValue('user@example.com');

    await component.sendResetRequest();

    expect(component.sendError()).toBe('forgot_password.send_error');
    expect(component.isSending()).toBe(false);
  });

  it('should not call API when email is invalid', async () => {
    await component.sendResetRequest();

    expect(authServiceMock.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('should navigate home after successful password reset', async () => {
    queryParamMap.set(new Map([['token', 'my-token']]));
    fixture.destroy();
    await createComponent();

    authServiceMock.resetPassword.mockResolvedValue(undefined);
    component.resetForm.controls.newPassword.setValue('newPass123!');

    await component.doPasswordReset();

    expect(authServiceMock.resetPassword).toHaveBeenCalledWith('my-token', 'newPass123!');
    expect(component.resetSuccess()).toBe(true);
    expect(routerMock.navigate).toHaveBeenCalledWith(['/home']);
  });
});