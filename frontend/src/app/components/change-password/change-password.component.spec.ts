import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChangePasswordComponent } from './change-password.component';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../services/auth.service';

describe.skip('ChangePasswordComponent', () => {
  let fixture: ComponentFixture<ChangePasswordComponent>;
  let component: ChangePasswordComponent;
  let authServiceMock: { changePassword: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authServiceMock = {
      changePassword: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ChangePasswordComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
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
    authServiceMock.changePassword.mockResolvedValue(undefined);

    await component.onSubmit();

    expect(authServiceMock.changePassword).toHaveBeenCalledWith('oldPass', 'newPass123!');
  });

  it('should not submit when currentPassword is empty', async () => {
    component.currentPassword.set('');
    component.newPassword.set('newPass123!');

    await component.onSubmit();

    expect(authServiceMock.changePassword).not.toHaveBeenCalled();
  });

  it('should not submit when newPassword is empty', async () => {
    component.currentPassword.set('oldPass');
    component.newPassword.set('');

    await component.onSubmit();

    expect(authServiceMock.changePassword).not.toHaveBeenCalled();
  });

  it('should show error on failure', async () => {
    component.currentPassword.set('oldPass');
    component.newPassword.set('newPass123!');
    authServiceMock.changePassword.mockRejectedValue(new Error('fail'));

    await component.onSubmit();

    expect(component.isError()).toBe(true);
    expect(component.messageKey()).toBe('auth.changePassword.error');
  });

  it('should disable submit button while submitting', () => {
    component.submitting.set(true);
    fixture.detectChanges();
    const btn = (fixture.nativeElement as HTMLElement).querySelector('button[type="submit"]');
    expect(btn?.hasAttribute('disabled')).toBe(true);
  });
});