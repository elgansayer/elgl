import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../services/translate.pipe';

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let authService: { resetPassword: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  function createActivatedRoute(token: string | null): ActivatedRoute {
    return {
      snapshot: {
        queryParamMap: {
          get: (_key: string) => token,
          has: (_key: string) => token !== null,
          getAll: (_key: string) => token ? [token] : [],
          keys: token ? ['token'] : [],
        },
      },
    } as unknown as ActivatedRoute;
  }

  describe('without token query param', () => {
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

    it('should render the form with an empty token input', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('#token')).not.toBeNull();
      expect(compiled.querySelector('#newPassword')).not.toBeNull();
    });

    it('should not call resetPassword when token is empty', async () => {
      component.token.set('');
      component.newPassword.set('validPass123!');
      await component.onSubmit();

      expect(authService.resetPassword).not.toHaveBeenCalled();
    });

    it('should not call resetPassword when newPassword is empty', async () => {
      component.token.set('some-token');
      component.newPassword.set('');
      await component.onSubmit();

      expect(authService.resetPassword).not.toHaveBeenCalled();
    });
  });

  describe('with token query param', () => {
    beforeEach(async () => {
      authService = { resetPassword: vi.fn() };
      router = { navigate: vi.fn() };

      await TestBed.configureTestingModule({
        imports: [ResetPasswordComponent],
        providers: [
          { provide: AuthService, useValue: authService },
          { provide: Router, useValue: router },
          { provide: ActivatedRoute, useValue: createActivatedRoute('abc-reset-token') },
          TranslatePipe,
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(ResetPasswordComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should pre-populate token from the route query param', () => {
      expect(component.token()).toBe('abc-reset-token');
    });

    it('should call authService.resetPassword and navigate on success', async () => {
      authService.resetPassword.mockResolvedValue(undefined);
      component.newPassword.set('strongPass1!');

      await component.onSubmit();

      expect(authService.resetPassword).toHaveBeenCalledWith('abc-reset-token', 'strongPass1!');
      expect(component.messageKey()).toBe('auth.resetPassword.success');
      expect(component.isError()).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('should set error message on failure', async () => {
      authService.resetPassword.mockRejectedValue(new Error('Bad token'));

      component.newPassword.set('strongPass1!');
      await component.onSubmit();

      expect(component.messageKey()).toBe('auth.resetPassword.error');
      expect(component.isError()).toBe(true);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should set submitting to false after successful reset', async () => {
      authService.resetPassword.mockResolvedValue(undefined);
      component.newPassword.set('strongPass1!');

      await component.onSubmit();

      expect(component.submitting()).toBe(false);
    });

    it('should set submitting to false after failed reset', async () => {
      authService.resetPassword.mockRejectedValue(new Error('Bad token'));

      component.newPassword.set('strongPass1!');
      await component.onSubmit();

      expect(component.submitting()).toBe(false);
    });
  });
});