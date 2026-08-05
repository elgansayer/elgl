import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../services/translate.pipe';

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let authService: { resetPassword: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  function createActivatedRoute(token: string | null) {
    return {
      queryParamMap: {
        get: vi.fn((key: string) => (key === 'token' ? token : null)),
        has: vi.fn((key: string) => key === 'token' && token !== null),
        getAll: vi.fn((key: string) => (key === 'token' && token ? [token] : [])),
        keys: token ? ['token'] : [],
      },
      snapshot: {
        queryParamMap: {
          get: (_key: string) => token,
        },
      },
    } as unknown as ActivatedRoute;
  }

  beforeEach(async () => {
    authService = { resetPassword: vi.fn() };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: createActivatedRoute(null) },
        TranslatePipe,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialise token from the route query param', () => {
    expect(component.token()).toBe('');
  });

  describe('when token is provided in route', () => {
    beforeEach(async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [ResetPasswordComponent],
        providers: [
          { provide: AuthService, useValue: authService },
          { provide: Router, useValue: router },
          { provide: ActivatedRoute, useValue: createActivatedRoute('my-reset-token') },
          TranslatePipe,
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(ResetPasswordComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should initialise token from the route snapshot', () => {
      expect(component.token()).toBe('my-reset-token');
    });
  });

  describe('onSubmit', () => {
    it('should not submit when token is empty', async () => {
      component.token.set('');
      component.newPassword.set('validPass123');
      await component.onSubmit();
      expect(authService.resetPassword).not.toHaveBeenCalled();
    });

    it('should not submit when newPassword is empty', async () => {
      component.token.set('token123');
      component.newPassword.set('');
      await component.onSubmit();
      expect(authService.resetPassword).not.toHaveBeenCalled();
    });

    it('should call authService.resetPassword and navigate on success', async () => {
      authService.resetPassword.mockResolvedValue(undefined);
      component.token.set('valid-token');
      component.newPassword.set('newPassword123');

      await component.onSubmit();

      expect(authService.resetPassword).toHaveBeenCalledWith('valid-token', 'newPassword123');
      expect(component.messageKey()).toBe('auth.resetPassword.success');
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('should set error message on failure', async () => {
      authService.resetPassword.mockRejectedValue(new Error('Invalid token'));
      component.token.set('bad-token');
      component.newPassword.set('newPassword123');

      await component.onSubmit();

      expect(component.isError()).toBe(true);
      expect(component.messageKey()).toBe('auth.resetPassword.error');
      expect(component.submitting()).toBe(false);
    });
  });
});