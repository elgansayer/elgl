import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

describe.skip('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let authServiceMock: { resetPassword: ReturnType<typeof vi.fn> };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authServiceMock = {
      resetPassword: vi.fn(),
    };

    routerMock = {
      navigate: vi.fn(),
    };

    const activatedRouteMock = {
      queryParamMap: of({
        get: (key: string) => (key === 'token' ? 'test-token-123' : null),
      }),
    };

    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
        { provide: Router, useValue: routerMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set token from query param on init', () => {
    expect(component.token()).toBe('test-token-123');
  });

  it('should call authService.resetPassword and navigate home on success', async () => {
    authServiceMock.resetPassword.mockResolvedValue(undefined);
    component.resetForm.setValue({ newPassword: 'newPass123!' });

    await component.onSubmit();

    expect(authServiceMock.resetPassword).toHaveBeenCalledWith('test-token-123', 'newPass123!');
    expect(routerMock.navigate).toHaveBeenCalledWith(['/home']);
    expect(component.messageKey()).toBe('auth.resetPassword.success');
  });

  it('should show error message on failure', async () => {
    authServiceMock.resetPassword.mockRejectedValue(new Error('bad token'));
    component.resetForm.setValue({ newPassword: 'newPass123!' });

    await component.onSubmit();

    expect(component.messageKey()).toBe('auth.resetPassword.error');
    expect(component.isError()).toBe(true);
    expect(routerMock.navigate).not.toHaveBeenCalled();
  });

  it('should not submit when token or password is empty', async () => {
    component.resetForm.setValue({ newPassword: '' });

    await component.onSubmit();

    expect(authServiceMock.resetPassword).not.toHaveBeenCalled();
  });
});
