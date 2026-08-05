import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ForgotPasswordComponent } from './forgot-password.component';
import { TranslatePipe } from '../../services/translate.pipe';
import { of } from 'rxjs';
import { signal, computed } from '@angular/core';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let httpMock: HttpTestingController;
  let router: Router;

  const mockTranslatePipe = {
    transform: (key: string) => key,
  };

  class MockTranslatePipe {
    static transform(key: string): string { return key; }
    transform(key: string): string { return key; }
  }

  function createComponent(queryParams: Record<string, string> = {}) {
    return TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, ForgotPasswordComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(new Map(Object.entries(queryParams))),
          },
        },
        {
          provide: Router,
          useValue: { navigate: jasmine.createSpy('navigate') },
        },
      ],
    })
      .overridePipe(TranslatePipe, {})
      .compileComponents()
      .then(() => {
        fixture = TestBed.createComponent(ForgotPasswordComponent);
        component = fixture.componentInstance;
        httpMock = TestBed.inject(HttpTestingController);
        router = TestBed.inject(Router);
        fixture.detectChanges();
      });
  }

  afterEach(() => {
    if (httpMock) {
      httpMock.verify();
    }
  });

  describe('email form (no token query param)', () => {
    beforeEach(() => createComponent());

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should render the email form when no token query param', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('h1')?.textContent).toContain('forgot_password.title');
      expect(compiled.querySelector('#email')).toBeTruthy();
    });

    it('should disable submit button when email is empty', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const button = compiled.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(button.disabled).toBeTrue();
    });

    it('should call the API and show success on valid email', () => {
      component.emailForm.controls.email.setValue('test@example.com');
      fixture.detectChanges();

      component.sendResetRequest();

      const req = httpMock.expectOne(
        (r) => r.url.includes('/auth/request-password-reset') && r.method === 'POST'
      );
      req.flush({ message: 'Reset link sent' });

      expect(component.sendSuccess()).toBeTrue();
      expect(component.isSending()).toBeFalse();
    });

    it('should show error when API call fails', () => {
      component.emailForm.controls.email.setValue('test@example.com');
      fixture.detectChanges();

      component.sendResetRequest();

      const req = httpMock.expectOne(
        (r) => r.url.includes('/auth/request-password-reset') && r.method === 'POST'
      );
      req.flush('Error', { status: 500, statusText: 'Server Error' });

      expect(component.sendError()).toBe('forgot_password.send_error');
      expect(component.isSending()).toBeFalse();
    });
  });

  describe('reset form (with token query param)', () => {
    beforeEach(() => createComponent({ token: 'abc123' }));

    it('should render the reset password form when token is present', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('#newPassword')).toBeTruthy();
    });

    it('should disable submit button when new password is empty', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const button = compiled.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(button.disabled).toBeTrue();
    });

    it('should call reset endpoint and navigate on success', () => {
      component.resetForm.controls.newPassword.setValue('newSecurePass123');
      fixture.detectChanges();

      component.doPasswordReset();

      const req = httpMock.expectOne(
        (r) => r.url.includes('/auth/reset-password') && r.method === 'POST'
      );
      expect(req.request.body.token).toBe('abc123');
      expect(req.request.body.newPassword).toBe('newSecurePass123');
      req.flush({ message: 'Password reset' });

      expect(component.resetSuccess()).toBeTrue();
      expect(component.isResetting()).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('should show error when reset API call fails', () => {
      component.resetForm.controls.newPassword.setValue('newSecurePass123');
      fixture.detectChanges();

      component.doPasswordReset();

      const req = httpMock.expectOne(
        (r) => r.url.includes('/auth/reset-password') && r.method === 'POST'
      );
      req.flush('Error', { status: 401, statusText: 'Unauthorized' });

      expect(component.resetError()).toBe('forgot_password.reset_error');
      expect(component.isResetting()).toBeFalse();
    });
  });
});