import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { signal } from '@angular/core';

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  async function createComponent(tokenParam: string | null = null) {
    authService = jasmine.createSpyObj('AuthService', [
      'resetPassword',
      'currentUser',
      'currentSession',
    ]);
    authService.currentUser = signal(null);
    authService.currentSession = signal(null);

    router = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: () => tokenParam,
              },
            },
          },
        },
      ],
    })
      .overridePipe(TranslatePipe, {})
      .compileComponents();

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => {
    fixture?.destroy();
  });

  describe('with no token param', () => {
    beforeEach(() => createComponent(null));

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize token signal as empty', () => {
      expect(component.token()).toBe('');
    });

    it('should not call resetPassword when token is empty on submit', () => {
      component.newPassword.set('test123456');
      component.onSubmit();
      expect(authService.resetPassword).not.toHaveBeenCalled();
    });
  });

  describe('with token param', () => {
    beforeEach(() => createComponent('reset-abc-123'));

    it('should populate token from query params', () => {
      expect(component.token()).toBe('reset-abc-123');
    });

    it('should call authService.resetPassword with token and newPassword', async () => {
      authService.resetPassword.and.resolveTo();

      component.newPassword.set('myNewPassword456');
      component.onSubmit();

      expect(authService.resetPassword).toHaveBeenCalledWith(
        'reset-abc-123',
        'myNewPassword456',
      );
      expect(component.messageKey()).toBe('auth.resetPassword.success');
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('should show error when resetPassword fails', async () => {
      authService.resetPassword.and.rejectWith(new Error('Auth error'));

      component.token.set('reset-abc-123');
      component.newPassword.set('myNewPassword456');
      component.onSubmit();

      await fixture.whenStable();

      expect(component.isError()).toBeTrue();
      expect(component.messageKey()).toBe('auth.resetPassword.error');
    });

    it('should disable submit button when submitting', () => {
      authService.resetPassword.and.returnValue(new Promise(() => {}));

      component.token.set('reset-abc-123');
      component.newPassword.set('myNewPassword456');
      component.onSubmit();

      fixture.detectChanges();
      expect(component.submitting()).toBeTrue();
    });

    it('should not submit when password is empty', () => {
      component.onSubmit();
      expect(authService.resetPassword).not.toHaveBeenCalled();
    });
  });
});